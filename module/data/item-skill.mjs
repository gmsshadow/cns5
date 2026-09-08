import { CNS5 } from "../config.mjs";
import { clampSuccessChance } from "../helpers/checks.mjs";

const fields = foundry.data.fields;

/**
 * A skill or competency.
 *
 * One item type covers both, because the rules treat them identically for
 * resolution: a competency is simply a skill that needs only a single level to
 * give its benefit. The `kind` field keeps them apart on the sheet, which lists
 * competencies in their own band, matching the printed layout.
 *
 * The derivation is not run in `prepareDerivedData`. Embedded items are prepared
 * before the parent actor's derived data exists, so the actor's attribute table
 * would not be available yet. Instead `CnS5ActorBase` calls `prepareForActor`
 * once its own attributes are ready.
 */
export class CnS5Skill extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      df: new fields.NumberField({
        required: true,
        integer: true,
        initial: 3,
        min: 1,
        max: 10
      }),

      // The attributes a skill is modified by, as they appear in the skills
      // list: a pair such as STR + AGL, a doubled attribute such as WIS x 2
      // recorded as the same key twice, or empty for a competency or an "N/A"
      // skill such as Alertness.
      attributes: new fields.ArrayField(
        new fields.StringField({ required: true, blank: false }),
        { required: true, initial: [] }
      ),

      kind: new fields.StringField({
        required: true,
        initial: "skill",
        choices: ["skill", "competency"]
      }),

      // The rulebook's own grouping — Agricultural, Combat, Thievish and so on.
      // This is a different axis from `category` below, which is the mechanical
      // standing of the skill for this character. A Sunsign grants favoured
      // groups, so the creation wizard will read this.
      group: new fields.StringField({ required: true, blank: true, initial: "" }),

      category: new fields.StringField({
        required: true,
        initial: "secondary",
        choices: Object.keys(CNS5.skillCategories)
      }),

      // Where the skill came from. Provenance only: a background or core skill
      // is promoted as a Secondary Skill like any other, so this carries no
      // adjustment of its own.
      origin: new fields.StringField({
        required: true,
        initial: "chosen",
        choices: Object.keys(CNS5.skillOrigins)
      }),

      // Level 0 is basic knowledge. `known` distinguishes a character who has
      // basic knowledge at Level 0 from one attempting the skill unskilled.
      known: new fields.BooleanField({ required: true, initial: true }),
      level: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Mastery and Sunsign each add a separate +10% to PSF, and both can apply
      // to the same skill, so they are flags rather than categories.
      mastered: new fields.BooleanField({ required: true, initial: false }),
      sunsign: new fields.BooleanField({ required: true, initial: false }),

      // [TR] in the skills list: cannot be attempted without basic knowledge.
      trainingRequired: new fields.BooleanField({ required: true, initial: false }),

      otherMod: new fields.NumberField({ required: true, integer: true, initial: 0 }),

      // A flat Personal Skill Factor, replacing the whole derivation. The
      // bestiary gives a creature's Dodge, Stamina and Willpower as bare PSF
      // figures with no attributes or levels behind them.
      psfOverride: new fields.NumberField({
        required: false, nullable: true, integer: true, initial: null
      }),

      // A few skills print something other than an attribute pair in the skills
      // list: 'N/A' for the two Alertness skills, 'Various' for Druidic Priest
      // Mode. Preserving the printed text explains the absent bonus.
      attributeNote: new fields.StringField({ required: true, blank: true, initial: "" }),
      resistedBy: new fields.StringField({ required: true, blank: true, initial: "" }),
      reference: new fields.StringField({ required: true, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true })
    };
  }

  /* -------------------------------------------- */

  /**
   * Bring older data up to date.
   *
   * Core and Background used to be categories of their own. They never were in
   * the rules — both are promoted as Secondary Skills — so they move to the
   * `origin` field, which is where that information actually belonged.
   *
   * @inheritDoc
   */
  static migrateData(source) {
    if (source.category === "core" || source.category === "background") {
      source.origin ??= source.category;
      source.category = "secondary";
    }
    return super.migrateData(source);
  }

  /* -------------------------------------------- */

  /**
   * Compute BCS%, PSF%, TSC% and the Min%/Max% band against a prepared actor.
   *
   * @param {object} actorSystem  the parent actor's prepared system data
   */
  prepareForActor(actorSystem) {
    const band = CNS5.difficultyFactors[this.df] ?? CNS5.difficultyFactors[3];

    this.band = band;
    this.min = band.min;
    this.max = band.max;
    this.expCost = band.exp;

    // A skill can always be attempted unskilled unless it is marked [TR].
    this.attemptable = this.known || !this.trainingRequired;
    this.bcs = this.known ? band.skilled : band.unskilled;

    // PSF, built in the order the rules give it (p34).
    this.attributeBonus = this.attributes.reduce(
      (total, key) => total + (actorSystem.attr?.[key]?.bonus ?? 0),
      0
    );
    this.levelBonus = this.known ? this.level * 3 : 0;
    this.categoryBonus = CNS5.skillCategories[this.category]?.psf ?? 0;
    this.masteryBonus = (this.mastered ? 10 : 0) + (this.sunsign ? 10 : 0);

    // A gentle character is better at courtesy and at command (p119). Courtly
    // Love is excepted in the Early Feudal period.
    const gentle = CNS5.gentleSkills.find(
      (entry) => entry.name.toLowerCase() === this.parent?.name?.toLowerCase()
    );
    this.gentleBonus =
      gentle && actorSystem.details?.gentle && !gentle.exceptPeriods.includes(actorSystem.details.period)
        ? gentle.bonus
        : 0;

    this.derivedPsf =
      this.attributeBonus +
      this.levelBonus +
      this.categoryBonus +
      this.masteryBonus +
      this.gentleBonus +
      this.otherMod;

    // An NPC's quality and campaign tier shift the PSF of every skill it has.
    this.psf = (this.psfOverride ?? this.derivedPsf) + (actorSystem.psfModifier ?? 0);
    this.psfIsOverridden = this.psfOverride !== null;

    // TSC before any situational modifier, and the clamped figure a player would
    // actually roll against right now.
    this.tsc = this.bcs + this.psf;

    const clamped = clampSuccessChance(this.tsc, this.df);
    this.target = clamped.target;
    this.critMod = clamped.critMod;
    this.overflow = clamped.overflow;
    this.shortfall = clamped.shortfall;

    // Failing an unskilled attempt worsens every Crit Die result by 2 (p38).
    this.failureCritMod = this.known ? 0 : -2;

    this.attributeLabel = this.#attributeLabel();
  }

  /* -------------------------------------------- */

  /**
   * Render the attribute pair the way the skills list prints it.
   * @returns {string}
   */
  #attributeLabel() {
    if (!this.attributes.length) {
      return this.attributeNote || game.i18n.localize("CNS5.Skill.noAttributes");
    }

    const abbr = (key) => game.i18n.localize(`CNS5.Attribute.${key}.abbr`);
    const [first, second] = this.attributes;

    if (this.attributes.length === 1) return abbr(first);
    if (first === second) return `${abbr(first)} × 2`;
    return `${abbr(first)} + ${abbr(second)}`;
  }
}
