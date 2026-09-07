import { CnS5ActorBase } from "./actor-base.mjs";

const fields = foundry.data.fields;

/**
 * Non-player characters share the whole attribute and vitals engine and add only
 * what a GM needs at the table: a short descriptor and a disposition note.
 */
export class CnS5NPC extends CnS5ActorBase {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.details = new fields.SchemaField({
      descriptor: new fields.StringField({ required: true, blank: true, initial: "" }),
      race: new fields.StringField({ required: true, initial: "Human" }),
      disposition: new fields.StringField({ required: true, blank: true, initial: "" })
    });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    if (this.details.race?.toLowerCase() === "human") this.jump += 2;
  }
}
