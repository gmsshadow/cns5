const fields = foundry.data.fields;

/**
 * Shared schema for anything a character can carry.
 *
 * Weight and quantity live here because encumbrance sums across every physical
 * item regardless of type: a sword, a suit of maille and a sack of grain all
 * count against Carrying Capacity in the same way.
 *
 * Money is recorded in farthings on the actor rather than as items, so coin
 * does not appear here.
 */
export class CnS5PhysicalItem extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      quantity: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
      weight: new fields.NumberField({ required: true, initial: 0, min: 0 }),

      // Cost is held in pennies, the unit the equipment tables use.
      cost: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Where the item is: worn, in hand, in a pack, on the packhorse. Free text
      // because the rules impose no fixed set and tables vary by campaign.
      location: new fields.StringField({ required: true, blank: true, initial: "" }),

      // Carried items count against CCAP; stowed ones are elsewhere entirely.
      carried: new fields.BooleanField({ required: true, initial: true }),
      equipped: new fields.BooleanField({ required: true, initial: false }),

      reference: new fields.StringField({ required: true, blank: true, initial: "" }),
      description: new fields.HTMLField({ required: false, blank: true })
    };
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    this.totalWeight = Math.round(this.weight * this.quantity * 100) / 100;
    this.totalCost = this.cost * this.quantity;
  }
}
