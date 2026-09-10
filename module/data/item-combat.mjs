import { CNS5 } from "../config.mjs";
import { CnS5PhysicalItem } from "./item-physical.mjs";

const fields = foundry.data.fields;

/**
 * A weapon.
 *
 * A weapon has no success chance of its own. It names the combat skill it is
 * used with, and the sheet reads TSC% from that skill on the character. That
 * keeps one number in one place: raising Slashing Swords by a level improves
 * every slashing sword the character owns, without touching any of them.
 */
export class CnS5Weapon extends CnS5PhysicalItem {
  static defineSchema() {
    const schema = super.defineSchema();

    // A launcher deals no damage itself but adds a bonus to what it looses;
    // ammunition carries the damage. Keeping them apart means a bow and its
    // arrows can each be their own item, as the tables list them.
    schema.role = new fields.StringField({
      required: true,
      initial: "melee",
      choices: ["melee", "launcher", "ammunition"]
    });

    schema.damageBonus = new fields.NumberField({ required: true, integer: true, initial: 0 });

    // The rulebook's own grouping — Knives, Polearms, War Spears.
    schema.group = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.dates = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.productionDays = new fields.NumberField({
      required: false, nullable: true, integer: true, initial: null
    });

    schema.weightClass = new fields.StringField({
      required: true,
      initial: "medium",
      choices: Object.keys(CNS5.weaponWeights)
    });

    schema.damageType = new fields.StringField({
      required: true,
      initial: "slash",
      choices: Object.keys(CNS5.damageTypes)
    });

    schema.baseDamage = new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 });
    schema.critDieModifier = new fields.NumberField({ required: true, integer: true, initial: 0 });
    // Action Point cost is derived from the wielder's PSF% rather than stored,
    // because the tables key it off skill rather than off the weapon. This is
    // an override for house rules and oddities; zero means derive.
    schema.apCost = new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 });

    // Which row of Table - Combat Actions this weapon attacks with. Blank picks
    // one from the weapon's role, group and weight.
    schema.apAction = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.bash = new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 });
    schema.length = new fields.StringField({ required: true, blank: true, initial: "" });

    // The name of the combat skill this weapon uses. Matched against the
    // character's skills by name, so it survives the skill being replaced.
    schema.skill = new fields.StringField({ required: true, blank: true, initial: "" });

    // A natural attack has no skill behind it — the bestiary prints a boar's
    // tusk as "Med. tusk (36) 16P", where 36 is the whole of its PSF. Setting
    // this makes the weapon rollable without any skill at all.
    schema.psfOverride = new fields.NumberField({
      required: false, nullable: true, integer: true, initial: null
    });

    schema.missile = new fields.BooleanField({ required: true, initial: false });
    schema.ranges = new fields.SchemaField({
      short: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      medium: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      long: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      extreme: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      max: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 })
    });

    // Each band carries its own TSC% modifier on top of the flat band penalty.
    schema.rangeModifiers = new fields.SchemaField({
      short: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      medium: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      long: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      extreme: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      max: new fields.NumberField({ required: true, integer: true, initial: 0 })
    });

    return schema;
  }

  /* -------------------------------------------- */

  /**
   * Resolve this weapon's success chance and damage against its wielder.
   *
   * Damage is base damage plus a Strength bonus plus the Attacker's Bonus for
   * the wielder's skill level, with the adjusted Crit Die added at the point of
   * the roll (p281).
   *
   * @param {object} actorSystem  the parent actor's prepared system data
   * @param {Item|null} skillItem the linked combat skill, if the character has it
   */
  prepareForActor(actorSystem, skillItem) {
    const isLight = CNS5.weaponWeights[this.weightClass]?.light ?? false;

    this.skillItem = skillItem ?? null;
    this.natural = this.psfOverride !== null;

    if (this.natural) {
      // A natural attack carries its own chance. Difficulty Factor 3 is the
      // ordinary band, which is what the printed figures assume.
      const band = CNS5.difficultyFactors[3];
      this.psf = this.psfOverride + (actorSystem.psfModifier ?? 0);
      this.level = 0;
      this.skillMissing = false;
      const total = band.skilled + this.psf;
      this.tsc = Math.min(Math.max(total, band.min), band.max);
      this.naturalDf = 3;
      this.naturalTsc = total;
    } else {
      this.psf = skillItem?.system.psf ?? 0;
      this.tsc = skillItem?.system.target ?? null;
      this.level = skillItem?.system.level ?? 0;
      this.skillMissing = !skillItem;
    }

    // A launcher contributes only its bonus; the strength of the arm does not
    // add to a crossbow bolt the way it adds to a sword blow. A natural attack
    // takes neither bonus: the bestiary's figure is the whole of its damage,
    // already settled by whoever wrote the creature.
    this.strengthBonus =
      this.role === "melee" && !this.natural
        ? isLight
          ? actorSystem.damageBonus.light
          : actorSystem.damageBonus.medium
        : 0;

    this.attackerBonus = this.natural ? 0 : CNS5.attackerBonus(this.level, this.weightClass);

    // Action Points. The derived figure is always computed so the sheet can show
    // what the tables would give even when an override is set.
    this.attackAction =
      this.apAction ||
      CNS5.weaponAttackAction({
        role: this.role,
        missile: this.missile,
        group: this.group,
        weightClass: this.weightClass,
        name: this.parent?.name ?? ""
      });
    this.derivedAp = CNS5.actionPointCost(this.attackAction, this.psf) ?? 0;
    this.ap = this.apCost > 0 ? this.apCost : this.derivedAp;
    this.apOverridden = this.apCost > 0;
    this.damage = this.natural
      ? this.baseDamage
      : this.role === "launcher"
        ? this.damageBonus
        : this.baseDamage + this.strengthBonus + this.attackerBonus;
  }
}

/* -------------------------------------------- */

/**
 * A piece of armour or a shield.
 *
 * Absorption is recorded per damage type, exactly as Table - Armour Absorption
 * prints it, because the whole point of the table is that maille is good
 * against a sword and poor against a spearpoint.
 */
export class CnS5Armour extends CnS5PhysicalItem {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.location = new fields.StringField({
      required: true,
      initial: "body",
      choices: Object.keys(CNS5.armourLocations)
    });

    // A launcher deals no damage itself but adds a bonus to what it looses;
    // ammunition carries the damage. Keeping them apart means a bow and its
    // arrows can each be their own item, as the tables list them.
    schema.role = new fields.StringField({
      required: true,
      initial: "melee",
      choices: ["melee", "launcher", "ammunition"]
    });

    schema.damageBonus = new fields.NumberField({ required: true, integer: true, initial: 0 });

    // The rulebook's own grouping — Knives, Polearms, War Spears.
    schema.group = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.dates = new fields.StringField({ required: true, blank: true, initial: "" });
    schema.productionDays = new fields.NumberField({
      required: false, nullable: true, integer: true, initial: null
    });

    schema.weightClass = new fields.StringField({
      required: true,
      initial: "light",
      choices: Object.keys(CNS5.armourWeights)
    });

    schema.absorption = new fields.SchemaField(
      Object.fromEntries(
        Object.keys(CNS5.damageTypes).map((key) => [
          key,
          new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 })
        ])
      )
    );

    // A cost in Fatigue Points, always positive. The tables print these as
    // negatives for heavier armour and as a bare 1 for the Cuirbolli Cuirass;
    // the magnitude is what matters, so the sign is normalised away.
    schema.fpToWear = new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 });

    // Shields are built to block, and each gives its own bonus to the attempt
    // (p279). Worn armour gives none.
    schema.blockBonus = new fields.NumberField({ required: true, integer: true, initial: 0 });

    // How heavy this shield is for the Fatigue cost of a block (p284). The
    // Fatigue table names Light, Medium and Heavy, which is a finer division
    // than the two shield play skills make, so it is recorded rather than
    // inferred from the skill.
    schema.defenceWeight = new fields.StringField({
      required: true,
      initial: "medium",
      choices: ["light", "medium", "heavy"]
    });

    // Every blow that gets past a shield adds ten per cent to the chance that
    // it breaks, and the chance stays with it until it is repaired.
    schema.failureChance = new fields.NumberField({
      required: true, integer: true, initial: 0, min: 0, max: 100
    });

    // Printed weights assume a 150-174 lb wearer. A bigger frame needs more
    // metal, so each piece carries a modifier applied in steps from that band.
    schema.weightModifier = new fields.NumberField({ required: true, initial: 0, min: 0 });

    // The armour type this piece is made of, which is what the absorption table
    // is keyed by. A Maille Coif and a Maille Hauberk share a type and differ
    // in everything else.
    schema.armourType = new fields.StringField({ required: true, blank: true, initial: "" });

    // Armour degrades as it absorbs blows, so damage taken is tracked per piece.
    schema.damageTaken = new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 });

    return schema;
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    super.prepareDerivedData();
    this.thiefPenalty = CNS5.armourWeights[this.weightClass]?.thiefPenalty ?? 0;
    this.dodgePenalty = CNS5.dodgePenalty[this.weightClass] ?? 0;

    // Off an actor there is no wearer to size against, so the printed weight
    // stands. `prepareForActor` overwrites this once there is one.
    this.wornWeight = this.weight;
  }

  /* -------------------------------------------- */

  /**
   * Size this piece to its wearer and recompute what it contributes to the
   * load. Called from the actor once its own weight is known.
   *
   * @param {object} actorSystem
   */
  prepareForActor(actorSystem) {
    this.wornWeight = CNS5.armourWeightFor(
      this.weight,
      this.weightModifier,
      actorSystem.size.weight
    );
    this.weightAdjustment = Math.round((this.wornWeight - this.weight) * 100) / 100;
    this.totalWeight = Math.round(this.wornWeight * this.quantity * 100) / 100;
  }
}
