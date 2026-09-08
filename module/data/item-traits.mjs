import { CNS5 } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * Shared shape for a talent or a flaw.
 *
 * Both are rolled on the same die, both are found on a table by a span of
 * results, and both trade in PC Points — a talent costs them and a flaw grants
 * them. Keeping the roll span on the item means the creation wizard can find an
 * entry from a die result without a lookup table of its own.
 */
class CnS5TraitBase extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // The span of results that produces this entry, as printed.
      roll: new fields.SchemaField({
        min: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
        max: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 })
      }),
      die: new fields.StringField({ required: true, initial: "1d100" }),
      reference: new fields.StringField({ required: true, blank: true, initial: "" }),
      notes: new fields.StringField({ required: true, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true })
    };
  }

  prepareDerivedData() {
    this.rollLabel =
      this.roll.min === this.roll.max
        ? `${this.roll.min}`
        : `${this.roll.min}-${this.roll.max}`;
  }
}

/* -------------------------------------------- */

/**
 * A special ability or talent (p88).
 *
 * Some are marked (w) and may only be held by a Well Aspected character. Others
 * carry no price at all: the table gives them as "Random roll only", meaning
 * they cannot be bought with PC Points and must be come by on the dice.
 */
export class CnS5Talent extends CnS5TraitBase {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.pcCost = new fields.NumberField({
      required: false, nullable: true, integer: true, initial: null, min: 0
    });
    schema.randomOnly = new fields.BooleanField({ required: true, initial: false });
    schema.wellAspectedOnly = new fields.BooleanField({ required: true, initial: false });

    return schema;
  }

  /**
   * Whether this talent is available to a given character.
   * @param {object} actorSystem
   */
  prepareForActor(actorSystem) {
    this.aspectAllowed =
      !this.wellAspectedOnly || actorSystem.details?.birthOmens === "well";
  }
}

/* -------------------------------------------- */

/**
 * A flaw, deficiency or defect (p95), or a phobia (pp.96-97).
 *
 * Flaws grant PC Points rather than costing them, which is the whole reason a
 * player takes one deliberately. A phobia additionally has a severity, and the
 * Willpower penalty for facing it follows from that (p94).
 */
export class CnS5Flaw extends CnS5TraitBase {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.kind = new fields.StringField({
      required: true,
      initial: "deficiency",
      choices: Object.keys(CNS5.flawKinds)
    });

    schema.pcBonus = new fields.NumberField({
      required: false, nullable: true, integer: true, initial: null, min: 0
    });

    // A phobia's intensity, which sets the Willpower penalty for facing it.
    schema.severity = new fields.StringField({
      required: true,
      initial: "minor",
      choices: Object.keys(CNS5.phobiaSeverities)
    });

    // What the phobia is a fear of, as the table names it.
    schema.fear = new fields.StringField({ required: true, blank: true, initial: "" });

    // Some entries send the reader to the Phobias or Curses table for detail.
    schema.rollsOnAnotherTable = new fields.BooleanField({ required: true, initial: false });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.isPhobia = this.kind === "phobia";
    this.willpowerPenalty = this.isPhobia
      ? CNS5.phobiaSeverities[this.severity]?.willpower ?? 0
      : 0;
  }
}
