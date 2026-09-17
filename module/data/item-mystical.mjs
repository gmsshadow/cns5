import { CNS5 } from "../config.mjs";
import {
  parseMagnitude,
  spellRangeBands,
  evaluateMagnitude,
  describeMagnitude
} from "../helpers/magnitude.mjs";

const fields = foundry.data.fields;

/**
 * A spell.
 *
 * Spells are bought with Magick Rating points at creation and cast at a Fatigue
 * and Action Point cost. The targeting chance comes from the caster's Mode of
 * Magick skill, modified by range: short is unpenalised, long is -10% and
 * maximum is -30% (character sheet, p599).
 */
export class CnS5Spell extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // The Mode of Magick this spell belongs to, matched by skill name.
      mode: new fields.StringField({ required: true, blank: true, initial: "" }),

      // The rulebook's own grouping — Basic Magick Air, Command Magick,
      // Transmutation Magick. Not the same thing as the Mode: the tables group
      // by element and school, which cuts across the Mode skills.
      group: new fields.StringField({ required: true, blank: true, initial: "" }),

      mr: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      fpToCast: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      apToCast: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Several spells print "Var" or "Spec" rather than a number: the cost
      // depends on how hard the caster pushes, or on the spell's own rules.
      // The printed text is kept so the sheet can show it instead of a zero.
      mrNote: new fields.StringField({ required: true, blank: true, initial: "" }),
      fatigueNote: new fields.StringField({ required: true, blank: true, initial: "" }),

      castingTime: new fields.StringField({ required: true, blank: true, initial: "" }),

      // The maximum range as the spell table prints it: "10' x ML", "Touch",
      // "1 mile x ML". Short and long ranges are worked out from it.
      rangeText: new fields.StringField({ required: true, blank: true, initial: "" }),
      duration: new fields.StringField({ required: true, blank: true, initial: "" }),
      prerequisite: new fields.StringField({ required: true, blank: true, initial: "" }),

      // No range fields. The spell tables print one figure and it is the
      // *maximum*: "Short Range (10% of Max Range), Long Range (50% of Max
      // Range), Maximal Range" (p296). The other two follow from it and from
      // the caster's Magick Level, so asking for them in three boxes asked for
      // something the rules derive — and left two of them empty.

      otherModifier: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      learnt: new fields.BooleanField({ required: true, initial: true }),
      reference: new fields.StringField({ required: true, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true })
    };
  }

  /* -------------------------------------------- */

  /**
   * Work out the targeting chance at each range band.
   *
   * @param {object} actorSystem
   * @param {Item|null} modeItem  the Mode of Magick skill, if the caster has it
   */
  /**
   * Read the printed range and duration once, whether or not anyone is casting
   * this. A spell sitting in a compendium can still say what it is worth.
   * @inheritDoc
   */
  prepareDerivedData() {
    super.prepareDerivedData?.();
    this.parsedRange = parseMagnitude(this.rangeText, "distance");
    this.parsedDuration = parseMagnitude(this.duration, "time");
  }

  /* -------------------------------------------- */

  prepareForActor(actorSystem, modeItem) {
    this.modeItem = modeItem ?? null;

    // A spell's reach depends on who is casting it, so the brackets are worked
    // out here rather than stored: the maximum is what the table prints, and
    // short and long are a tenth and a half of it (p296).
    const level = actorSystem.magick?.level ?? 1;
    this.rangeBands = spellRangeBands(this.parsedRange, level);
    this.rangeLabels = this.rangeBands
      ? {
          short: describeMagnitude(this.rangeBands.short, "distance"),
          long: describeMagnitude(this.rangeBands.long, "distance"),
          max: describeMagnitude(this.rangeBands.max, "distance")
        }
      : null;

    const seconds = evaluateMagnitude(this.parsedDuration, level);
    this.durationLabel =
      seconds === null ? this.duration : describeMagnitude(seconds, "time");
    this.modeMissing = !modeItem;
    this.methodModifier = modeItem?.system.psf ?? 0;

    const base = modeItem?.system.target ?? 0;
    this.targets = Object.fromEntries(
      Object.entries(CNS5.spellRanges).map(([key, band]) => [
        key,
        Math.max(0, base + band.modifier + this.otherModifier)
      ])
    );
  }
}

/* -------------------------------------------- */

/**
 * An Act of Faith.
 *
 * Unlike a spell, an Act of Faith has a minimum Personal Faith Factor rather
 * than a cost in Magick Rating points: a cleric either has enough standing with
 * their god to attempt it or does not.
 */
export class CnS5ActOfFaith extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      religion: new fields.StringField({ required: true, blank: true, initial: "" }),

      // Which vocations may invoke this Act (pp.145-146). Empty means the
      // rulebook places no restriction, or none has been recorded.
      vocations: new fields.ArrayField(
        new fields.StringField({ required: true, blank: false }),
        { required: true, initial: [] }
      ),

      // The rulebook's own grouping — Clerical Acts of Faith, the Sacraments.
      section: new fields.StringField({ required: true, blank: true, initial: "" }),

      pffMinimum: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      successChance: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      fpCost: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      apToPray: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      notes: new fields.StringField({ required: true, blank: true, initial: "" }),
      reference: new fields.StringField({ required: true, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true })
    };
  }

  /* -------------------------------------------- */

  /**
   * @param {object} actorSystem
   */
  prepareForActor(actorSystem) {
    this.available = (actorSystem.faith?.pff ?? 0) >= this.pffMinimum;
  }
}

/* -------------------------------------------- */

/**
 * A religion the character holds to.
 *
 * A character may follow more than one, each with its own standing, which is
 * why Spirit is tracked per religion on the printed sheet rather than once.
 */
export class CnS5Religion extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      primary: new fields.BooleanField({ required: true, initial: false }),
      beliefStatus: new fields.StringField({ required: true, blank: true, initial: "" }),

      // Spirit standing with this faith specifically.
      spirit: new fields.NumberField({ required: true, integer: true, initial: 0 }),

      // An override for the derived Personal Faith Factor. The primary religion
      // derives PFF from the Faith skill; a secondary faith usually does not,
      // so it is entered by hand.
      pffOverride: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        initial: null
      }),

      hindrances: new fields.HTMLField({ required: false, blank: true }),
      description: new fields.HTMLField({ required: false, blank: true })
    };
  }

  /* -------------------------------------------- */

  /**
   * @param {object} actorSystem
   */
  prepareForActor(actorSystem) {
    this.pff = this.pffOverride ?? (this.primary ? actorSystem.faith.pff : 0);
  }
}
