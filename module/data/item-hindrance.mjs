import { CNS5 } from "../config.mjs";

const fields = foundry.data.fields;

/**
 * A Spiritual Hindrance (pp.407-412).
 *
 * "The foibles that influence one's unique character", and the measure of how
 * far a person stands from The Divine. A character starts with five, and the
 * more he has, the lower the ceiling on his Spirit.
 *
 * Its severity decides how much Grace resisting it wins, how hard it is to
 * recognise in oneself, and it may change: mastered down a level, or worsened
 * by a failed attempt to be rid of it.
 */
export class CnS5Hindrance extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      kind: new fields.StringField({
        required: true,
        initial: "physical",
        choices: Object.keys(CNS5.hindranceKinds)
      }),
      severity: new fields.StringField({
        required: true,
        initial: "minor",
        choices: Object.keys(CNS5.hindranceSeverities)
      }),
      dark: new fields.StringField({
        required: true,
        initial: "none",
        choices: Object.keys(CNS5.hindranceDarkness)
      }),

      // Whether the character knows he has it. "A successful Read Character
      // roll... is required for a character to initially realise that they
      // even have an impediment" (p411), and he cannot work at one he has not
      // recognised.
      discovered: new fields.BooleanField({ required: true, initial: false }),

      reference: new fields.StringField({ required: true, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true })
    };
  }

  prepareDerivedData() {
    // A potentially Dark hindrance counts as Dark only when the Gamemaster says
    // it has become so; until then it is ordinary.
    this.isDark = this.dark === "dark";
    this.pcPoints = this.isDark ? CNS5.darkHindrancePcPoints : 0;
    this.severityRank = CNS5.severityOrder.indexOf(this.severity);
    this.kindLabel = CNS5.hindranceKinds[this.kind];
    this.severityLabel = CNS5.hindranceSeverities[this.severity];
  }
}
