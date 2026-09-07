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
      entry.ar = CNS5.attributeRoll(entry.value);
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
    this.damageBonus = {
      medium: Math.ceil(this.asr / 2),
      light: Math.floor(this.asr / 4)
    };

    this.jump = Math.ceil((str + agl) / 4) + (this.jumpModifier ?? 0);

    this.bap = Math.floor(Math.max(agl + fer, agl + int) / 2);
    this.bapFromIntellect = int > fer;
  }
}
