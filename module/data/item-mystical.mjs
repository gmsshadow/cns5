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
      // The school this spell belongs to, matched by skill name.
      //
      // Named `mode` for want of a rename. It holds a *Method* of Magick — a
      // school, such as Command Magick or Basic Magick – Fire — and not a Mode,
      // which is the tradition a mage was trained in. The two are different
      // skills with different Difficulty Factors, and calling one by the other's
      // name has already caused one bug: the casting roll reached for the
      // tradition where the school belonged. Read it through `method` below.
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

      // How much of the spell's Magick Resistance the caster has still to
      // bring down before it is his. Nought is known, which is where every spell
      // starts on a sheet: a character's spells are taken as learnt unless a
      // player or Gamemaster says otherwise (p294, p299).
      mrRemaining: new fields.NumberField({
        required: true, integer: true, initial: 0, min: 0
      }),

      // Whether the target may resist. Left unset, it follows the rule of thumb
      // — spells that charm, command, frighten or confuse — because each spell's
      // own description says how it may be resisted and that is prose, not
      // data. A Gamemaster can set it either way.
      resisted: new fields.BooleanField({ required: false, nullable: true, initial: null }),
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
  /**
   * The Method of Magick this spell is cast with: the school, not the
   * tradition.
   *
   * The stored field is still called `mode`, which is the wrong word for what
   * it holds. Renaming it means a schema change and a migration, so instead
   * everything written from here on reads it by its right name and the old one
   * is left alone underneath.
   *
   * @returns {string}
   */
  get method() {
    return this.mode;
  }

  /**
   * The skill that Method resolves to on the caster, or null.
   * @returns {Item|null}
   */
  get methodItem() {
    return this.modeItem ?? null;
  }

  /**
   * The Method actually used, once the caster's own schools have been
   * consulted for a spell belonging to none in particular.
   * @returns {string}
   */
  get resolvedMethod() {
    return this.resolvedMode ?? "";
  }

  /**
   * Whether the Method this spell names cannot be found on the caster.
   * @returns {boolean}
   */
  get methodMissing() {
    return Boolean(this.modeMissing);
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    super.prepareDerivedData?.();
    this.parsedRange = parseMagnitude(this.rangeText, "distance");
    this.parsedDuration = parseMagnitude(this.duration, "time");
    this.resistable = CNS5.isResistable({ ...this, name: this.parent?.name });
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

    // What this spell is worth to *this* caster. His tradition raises or lowers
    // the Magick Resistance of every school (p295), within the bounds of 1 and
    // 10, and anything the modifier would carry past 10 is paid for in
    // Fatigue instead: 3 FP a point (p294). So a spell's MR and cost on a
    // mage's sheet are his, not the table's.
    const tradition = CNS5.effectiveLearningMr({
      mr: this.mr,
      method: this.resolvedMethod || this.method,
      mode: actorSystem.magick?.mode ?? ""
    });
    this.effectiveMr = tradition.effective;
    this.traditionModifier = tradition.modifier;
    this.mrSurcharge = tradition.fatigueSurcharge;
    this.effectiveFp = (this.fpToCast ?? 0) + tradition.fatigueSurcharge;

    // A spell not yet brought down to nought is cast at a loss, and may
    // backfire (p299). Never more to go than the spell has for this caster.
    this.remaining = Math.min(this.mrRemaining ?? 0, this.effectiveMr);
    this.partlyLearnt = this.remaining > 0;
    this.learningPenalty = this.remaining * CNS5.partlyLearntPenalty;
    this.daysToNextStep = CNS5.daysToNextStep(this.remaining, level);

    // The chance before anything in the way is counted: the caster's skill in
    // the school, and the spell's own modifier.
    //
    // There used to be three of these, one per range band, printed as the
    // buttons that cast the spell. They predate targeting and took no account
    // of the target's own resistance, of movement, of obstacles or of the mana
    // of the place — so they were three numbers that were right only against an
    // unresisting target standing in the open. One honest figure is better than
    // three misleading ones, and the roll settles the rest.
    this.baseChance = Math.max(0, (modeItem?.system.target ?? 0) + this.otherModifier);
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

      // How the description gives the chance: "Faith TSC%", "2/3 Faith TSC%",
      // "Recipient's Spirit AR". It is kept as written because it is a formula
      // against the supplicant or the recipient, not a number (p404).
      successChanceText: new fields.StringField({ required: true, blank: true, initial: "" }),

      // Likewise the cost: "-3 FP from Supplicant", "-Crit Die FP from Cleric".
      costText: new fields.StringField({ required: true, blank: true, initial: "" }),

      // "Auto: Automatically takes effect (i.e. no Spirit AR% roll, etc. is
      // required)" — the Sacraments, which "always succeed" (p404).
      automatic: new fields.BooleanField({ required: true, initial: false }),

      // "† Acts of Faith that are solely within the competence of ordained
      // priests. ‡ Acts of Faith that may only invoked by ordained Priests,
      // Monastics (monks, nuns) and members of Holy Fighting Orders" (p404).
      ordainedOnly: new fields.BooleanField({ required: true, initial: false }),
      monasticOnly: new fields.BooleanField({ required: true, initial: false }),

      // An Act whose effect is another's: "Equivalent: Greater Miracle".
      equivalentTo: new fields.StringField({ required: true, blank: true, initial: "" }),
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
