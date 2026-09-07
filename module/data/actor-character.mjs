import { CNS5 } from "../config.mjs";
import { CnS5ActorBase } from "./actor-base.mjs";

const fields = foundry.data.fields;

/**
 * Player character data.
 *
 * The `details` block deliberately mirrors the printed sheet's header and the
 * Background & Social page, because the creation worksheet writes into exactly
 * those fields and a later wizard will want somewhere to put its results.
 */
export class CnS5Character extends CnS5ActorBase {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.details = new fields.SchemaField({
      characterType: new fields.StringField({
        required: true,
        initial: "historical",
        choices: Object.keys(CNS5.characterTypes)
      }),
      period: new fields.StringField({
        required: true,
        initial: "hc",
        choices: Object.keys(CNS5.periods)
      }),
      race: new fields.StringField({ required: true, initial: "Human" }),
      gender: new fields.StringField({ required: true, blank: true, initial: "" }),
      age: new fields.NumberField({ required: true, integer: true, initial: 18, min: 0 }),
      vocation: new fields.StringField({ required: true, blank: true, initial: "" }),
      socialClass: new fields.StringField({ required: true, blank: true, initial: "" }),
      socialStatus: new fields.StringField({ required: true, blank: true, initial: "" }),
      fathersVocation: new fields.StringField({ required: true, blank: true, initial: "" }),
      familyStatus: new fields.StringField({ required: true, blank: true, initial: "" }),
      birthOmens: new fields.StringField({
        required: true,
        initial: "neutral",
        choices: Object.keys(CNS5.birthOmens)
      }),
      starSign: new fields.StringField({ required: true, blank: true, initial: "" }),
      nationality: new fields.StringField({ required: true, blank: true, initial: "" }),
      liege: new fields.StringField({ required: true, blank: true, initial: "" }),
      influenceFactor: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      familyNotes: new fields.HTMLField({ required: false, blank: true })
    });

    schema.experience = new fields.SchemaField({
      earned: new fields.NumberField({ required: true, integer: true, initial: 5000, min: 0 }),
      spent: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 })
    });

    // Spirit is tracked separately from the SPR attribute: the attribute is the
    // ceiling a character was created with, this is the current standing (p103).
    schema.spirit = new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: 0 })
    });

    // Magick and Faith are entered by hand for now. Phase 4 derives PMF from the
    // Mode of Magick skill and PFF from the Faith skill, once skills exist.
    schema.magick = new fields.SchemaField({
      pmf: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      level: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      resistanceOverride: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        initial: null
      })
    });

    schema.faith = new fields.SchemaField({
      pff: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      religion: new fields.StringField({ required: true, blank: true, initial: "" })
    });

    return schema;
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    super.prepareDerivedData();

    // Humans add +2 feet to their base Jump (p112).
    if (this.details.race?.toLowerCase() === "human") this.jump += 2;

    this.experience.available = this.experience.earned - this.experience.spent;

    this.magick.resistance =
      this.magick.resistanceOverride ?? CNS5.magickResistance[this.details.birthOmens] ?? 0;

    this.attributeMax = CNS5.attributeMaximum[this.details.characterType] ?? 20;
  }
}
