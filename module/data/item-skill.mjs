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

    this.psf =
      this.attributeBonus +
      this.levelBonus +
      this.categoryBonus +
      this.masteryBonus +
      this.otherMod;

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
