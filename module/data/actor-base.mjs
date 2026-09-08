import { CNS5 } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Shared schema and derivation for every actor type.
 *
 * The split matters: attributes, Body, Fatigue and the Crit Die machinery are
 * identical for a player character and a guard. Only the social, magickal and
 * experience apparatus is character-only.
 */
export class CnS5ActorBase extends foundry.abstract.TypeDataModel {
  /* -------------------------------------------- */

  static defineSchema() {
    const schema = {};

    schema.attributes = new fields.SchemaField(
      Object.fromEntries(
        ["str", "con", "dex", "int", "wis", "dis", "app", "bv", "spr"].map((key) => [
          key,
          new fields.SchemaField({
            value: new fields.NumberField({
              required: true,
              integer: true,
              initial: 10,
              min: 0
            })
          })
        ])
      )
    );

    // AGL, FER and CHA are averages of three other attributes plus an innate
    // aptitude modifier bought or rolled at creation. The override lets a GM pin
    // a value for a creature that does not follow the human derivation.
    schema.derived = new fields.SchemaField(
      Object.fromEntries(
        Object.keys(CNS5.derivedAttributes).map((key) => [
          key,
          new fields.SchemaField({
            mod: new fields.NumberField({ required: true, integer: true, initial: 0 }),
            override: new fields.NumberField({
              required: false,
              nullable: true,
              integer: true,
              initial: null
            })
          })
        ])
      )
    );

    schema.body = new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: 10 }),
      bonus: new fields.NumberField({ required: true, integer: true, initial: 0 })
    });

    schema.fatigue = new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: 10 }),
      bonus: new fields.NumberField({ required: true, integer: true, initial: 0 })
    });

    schema.size = new fields.SchemaField({
      height: new fields.NumberField({ required: true, integer: true, initial: 68, min: 1 }),
      build: new fields.NumberField({ required: true, integer: true, initial: 5 }),
      weight: new fields.NumberField({ required: true, integer: true, initial: 150, min: 1 })
    });

    schema.biography = new fields.HTMLField({ required: false, blank: true });

    return schema;
  }

  /* -------------------------------------------- */

  /**
   * Order matters here. Derived attributes depend on the primaries, the
   * attribute bonus and AR% depend on the final attribute value, and Body,
   * Fatigue, LCAP and BAP all depend on those. So this runs strictly top down.
   */
  prepareDerivedData() {
    this.#prepareAttributes();
    this.#prepareVitals();
    this.#prepareCapacities();
    this.#prepareSkills();
    this.#prepareCombat();
    this.#prepareEncumbrance();
  }

  /* -------------------------------------------- */

  /**
   * Derive every skill's BCS%, PSF% and TSC%.
   *
   * This runs here rather than in the item's own prepareDerivedData because
   * embedded documents are prepared during prepareEmbeddedDocuments, which
   * happens before the parent actor's derived data exists. A skill needs the
   * attribute bonuses computed above, so it has to wait for them.
   */
  #prepareSkills() {
    for (const item of this.parent.items) {
      if (item.type === "skill") item.system.prepareForActor(this);
    }
  }

  /* -------------------------------------------- */

  /**
   * Resolve weapons against their combat skills, and total the protection from
   * everything currently worn.
   *
   * Shields are summed separately because they are interposed by an active
   * defence rather than worn: a shield only absorbs when the defender succeeds
   * at a shield block, so adding it to worn protection would overstate it.
   */
  #prepareCombat() {
    const skills = new Map(
      this.parent.items
        .filter((i) => i.type === "skill")
        .map((i) => [i.name.toLowerCase(), i])
    );

    const zero = () => Object.fromEntries(Object.keys(CNS5.damageTypes).map((k) => [k, 0]));
    this.protection = zero();
    this.shieldProtection = zero();
    this.armourWeight = "none";
    this.dodgePenalty = 0;
    this.fatigueToWear = 0;

    let heaviest = 0;
    const order = ["none", "light", "heavy", "battle"];

    for (const item of this.parent.items) {
      if (item.type === "weapon") {
        // A weapon with no skill named on it falls back to the one its group
        // implies, so a bow dragged in from the compendium is rollable without
        // anyone having to type "Archery" into it first.
        // A natural attack states its own chance and needs no skill at all.
        const wanted =
          item.system.psfOverride !== null
            ? ""
            : item.system.skill ||
              CNS5.weaponSkill({
                name: item.name,
                group: item.system.group,
                role: item.system.role
              });
        item.system.resolvedSkill = wanted;
        item.system.prepareForActor(this, skills.get(wanted.toLowerCase()) ?? null);
        continue;
      }
      if (item.type !== "armour") continue;

      // Every piece is sized to its wearer, worn or not: an unworn hauberk in
      // the baggage still weighs what it weighs for this character.
      item.system.prepareForActor(this);
      if (!item.system.equipped) continue;

      const target = item.system.location === "shield" ? this.shieldProtection : this.protection;
      for (const key of Object.keys(CNS5.damageTypes)) {
        target[key] += item.system.absorption[key];
      }

      if (item.system.location === "shield") continue;
      this.fatigueToWear += item.system.fpToWear;
      const rank = order.indexOf(item.system.weightClass);
      if (rank > heaviest) {
        heaviest = rank;
        this.armourWeight = item.system.weightClass;
      }
    }

    this.dodgePenalty = CNS5.dodgePenalty[this.armourWeight] ?? 0;
    this.thiefPenalty = CNS5.armourWeights[this.armourWeight]?.thiefPenalty ?? 0;

    // The Action Point pool for a round: Base Action Points, modified for what
    // is worn, plus a d10 rolled as initiative (p268). Wearing nothing is worth
    // three points rather than none.
    const modifiers = CNS5.armourModifiers[this.armourWeight] ?? CNS5.armourModifiers.light;
    this.actionPoints = {
      base: this.bap,
      armour: modifiers.ap,
      armourFatigue: modifiers.fatigue,
      // Running out of Fatigue costs ten Action Points a round.
      exhausted: this.fatigue.value <= 0 ? CNS5.exhaustedApPenalty : 0
    };
    this.actionPoints.bonus =
      this.actionPoints.base + this.actionPoints.armour + this.actionPoints.exhausted;
  }

  /* -------------------------------------------- */

  /**
   * Total what is carried and work out the Fatigue cost of carrying it.
   *
   * Exceeding Carrying Capacity costs 1 Fatigue Point per hour for every 20% of
   * CCAP the load is over, rounded up (p111). The printed sheet tabulates this
   * to +100%; the rule itself has no ceiling, so this computes it.
   */
  #prepareEncumbrance() {
    const carried = this.parent.items.filter(
      (i) => i.system.carried && Number.isFinite(i.system.totalWeight)
    );

    const load = carried.reduce((total, i) => total + i.system.totalWeight, 0);
    const over = Math.max(0, load - this.ccap);

    this.encumbrance = {
      load: Math.round(load * 100) / 100,
      capacity: this.ccap,
      over: Math.round(over * 100) / 100,
      // Percentage of CCAP the load represents, for the sheet's load bar.
      percent: this.ccap > 0 ? Math.round((load / this.ccap) * 100) : 0,
      fatiguePerHour:
        over > 0 && this.ccap > 0
          ? Math.ceil(over / (CNS5.encumbranceStep * this.ccap))
          : 0
    };

    // A load also shortens a jump: -1 foot per 10% of CCAP carried (p113).
    this.jumpLoaded = Math.max(0, this.jump - Math.ceil(this.encumbrance.percent / 10));
  }

  /* -------------------------------------------- */

  /**
   * Merge the primary and derived attributes into a single `attr` object so the
   * sheet and the roll code never have to care which kind an attribute is.
   */
  #prepareAttributes() {
    const rounding = game.settings.get("cns5", "attributeRounding");
    const round = rounding === "nearest" ? Math.round : Math.floor;

    this.attr = {};

    for (const [key, data] of Object.entries(this.attributes)) {
      this.attr[key] = { key, value: data.value, derived: false };
    }

    for (const [key, def] of Object.entries(CNS5.derivedAttributes)) {
      const store = this.derived[key];
      const base = round(def.from.reduce((sum, k) => sum + this.attributes[k].value, 0) / 3);
      const value = store.override ?? base + store.mod;
      this.attr[key] = { key, value, base, mod: store.mod, derived: true };
    }

    for (const entry of Object.values(this.attr)) {
      entry.bonus = CNS5.attributeBonus(entry.value);
      // An NPC's quality and campaign tier shift every Attribute Roll it makes.
      entry.ar = Math.max(1, CNS5.attributeRoll(entry.value) + (this.arModifier ?? 0));
    }
  }

  /* -------------------------------------------- */

  /**
   * Step 13: Body = Weight Factor + CON + half STR, rounded down.
   * Step 14: Fatigue = the better of CON+STR and CON+DIS.
   */
  #prepareVitals() {
    const str = this.attr.str.value;
    const con = this.attr.con.value;
    const dis = this.attr.dis.value;

    this.body.weightFactor = CNS5.weightFactor(this.size.weight);
    this.body.max = this.body.weightFactor + con + Math.floor(str / 2) + this.body.bonus;
    this.body.recovery = CNS5.bodyRecovery(con);
    // Death occurs below negative CON, so CON itself is survivable (p108).
    this.body.deathAt = -con - 1;

    this.fatigue.max = con + Math.max(str, dis) + this.fatigue.bonus;
    this.fatigue.fromDiscipline = dis > str;
    this.fatigue.recovery = CNS5.fatigueRecovery(con);
  }

  /* -------------------------------------------- */

  /**
   * Step 15: LCAP = 5 lbs + a percentage of body weight; CCAP is half that,
   * rounded up. ASR is the square root of LCAP, rounded down (p106).
   * Step 16: Jump = a quarter of STR+AGL, rounded up.
   * Step 17: BAP is the better of (AGL+FER)/2 and (AGL+INT)/2, rounded down,
   *   with FER and INT capped at 20 but AGL counted in full.
   */
  #prepareCapacities() {
    const str = this.attr.str.value;
    const agl = this.attr.agl.value;
    const fer = Math.min(this.attr.fer.value, 20);
    const int = Math.min(this.attr.int.value, 20);

    this.lcap = 5 + Math.floor((CNS5.liftingPercent(str) / 100) * this.size.weight);
    this.ccap = Math.ceil(this.lcap / 2);
    this.asr = Math.floor(Math.sqrt(this.lcap));

    // p106 derives the Strength damage bonus from the Absolute Strength Rating,
    // p281 from the Strength attribute. See the strengthDamageSource setting.
    this.damageBonus =
      game.settings.get("cns5", "strengthDamageSource") === "attribute"
        ? { medium: Math.floor(str / 2), light: Math.floor(str / 4) }
        : { medium: Math.ceil(this.asr / 2), light: Math.floor(this.asr / 4) };

    this.jump = Math.ceil((str + agl) / 4) + (this.jumpModifier ?? 0);

    this.bap = Math.floor(Math.max(agl + fer, agl + int) / 2);
    this.bapFromIntellect = int > fer;
  }
}
