import { CNS5 } from "../config.mjs";
import { CnS5ActorBase } from "./actor-base.mjs";

const fields = foundry.data.fields;

/**
 * Non-player characters, of two rather different sorts.
 *
 * A *person* is built the way a character is: attributes, from which Body,
 * Fatigue and Base Action Points all follow.
 *
 * A *creature* is not. The bestiary gives a boar a Body of 57 and a Fatigue of
 * 34 directly, and never mentions its Constitution, because the figures were
 * settled by whoever wrote the table rather than derived from anything. So a
 * creature's vitals are entered as printed and the derivation is skipped. The
 * attribute schema is still there and still works — it is simply not what a
 * creature is described by.
 */
export class CnS5NPC extends CnS5ActorBase {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.kind = new fields.StringField({
      required: true,
      initial: "person",
      choices: Object.keys(CNS5.npcKinds)
    });

    schema.quality = new fields.StringField({
      required: true,
      initial: "average",
      choices: Object.keys(CNS5.npcQuality)
    });

    schema.tier = new fields.StringField({
      required: true,
      initial: "historical",
      choices: Object.keys(CNS5.npcTier)
    });

    schema.details = new fields.SchemaField({
      descriptor: new fields.StringField({ required: true, blank: true, initial: "" }),
      race: new fields.StringField({ required: true, initial: "Human" }),
      disposition: new fields.StringField({ required: true, blank: true, initial: "" }),
      // The bestiary's Hon column. It is not explained where the tables are
      // printed, so it is carried through as a number rather than interpreted.
      honour: new fields.NumberField({ required: true, integer: true, initial: 0 })
    });

    // Creatures state these outright. Left blank, they derive as for a person.
    schema.vitals = new fields.SchemaField({
      bodyOverride: new fields.NumberField({
        required: false, nullable: true, integer: true, initial: null
      }),
      fatigueOverride: new fields.NumberField({
        required: false, nullable: true, integer: true, initial: null
      }),
      bapOverride: new fields.NumberField({
        required: false, nullable: true, integer: true, initial: null
      })
    });

    schema.movement = new fields.SchemaField({
      pace: new fields.StringField({ required: true, blank: true, initial: "" }),
      sprint: new fields.StringField({ required: true, blank: true, initial: "" })
    });

    schema.magickResistance = new fields.NumberField({
      required: true, integer: true, initial: 0, min: 0
    });

    return schema;
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    // Quality and tier are set before the base preparation, because every skill
    // and every Attribute Roll on this actor is modified by them.
    const quality = CNS5.npcQuality[this.quality] ?? CNS5.npcQuality.average;
    const tier = CNS5.npcTier[this.tier] ?? CNS5.npcTier.historical;
    this.psfModifier = quality.psf + tier.psf;
    this.arModifier = quality.ar + tier.ar;

    super.prepareDerivedData();

    if (this.details.race?.toLowerCase() === "human") this.jump += 2;

    // A creature's printed figures replace the derived ones.
    this.isCreature = this.kind === "creature";
    if (this.vitals.bodyOverride !== null) this.body.max = this.vitals.bodyOverride;
    if (this.vitals.fatigueOverride !== null) this.fatigue.max = this.vitals.fatigueOverride;
    if (this.vitals.bapOverride !== null) this.bap = this.vitals.bapOverride;

    this.magick = { resistance: this.magickResistance };
  }
}
