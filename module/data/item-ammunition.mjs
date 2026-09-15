import { CNS5 } from "../config.mjs";
import { CnS5PhysicalItem } from "./item-physical.mjs";

const fields = foundry.data.fields;

/**
 * Ammunition: arrows, bolts, stones and bullets.
 *
 * A type of its own rather than a weapon with a part to play. Treating a quiver
 * of arrows as a weapon meant it sat in the weapons list waiting to be rolled
 * as an attack, carried a set of ranges of its own that belonged to no
 * particular bow, and could be confused with the bow that shot it. None of
 * those follow from anything in the rules: an arrow is not a weapon, it is what
 * a weapon shoots.
 *
 * What an arrow does carry is what it contributes to a shot — its damage, the
 * Crit Die modifier that comes from the head, and its chance of bashing —
 * because Table - Missile Weapons gives it those. What it does not carry is
 * range, because range belongs to the bow and the arrow together and is looked
 * up as a pairing (p258).
 */
export class CnS5Ammunition extends CnS5PhysicalItem {
  static defineSchema() {
    const schema = super.defineSchema();

    // What shoots it. A bow takes arrows and a crossbow bolts, and matching the
    // two is the whole of what makes a shot possible.
    schema.kind = new fields.StringField({
      required: true,
      initial: "arrow",
      choices: Object.keys(CNS5.ammunitionKinds)
    });

    schema.baseDamage = new fields.NumberField({
      required: true, integer: true, initial: 0, min: 0
    });

    // A missile is resisted by the Missile column of the armour table whatever
    // its head is shaped like (p257).
    schema.damageType = new fields.StringField({ required: true, initial: "missile" });

    schema.critDieModifier = new fields.NumberField({
      required: true, integer: true, initial: 0
    });

    schema.bash = new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.kindLabel = CNS5.ammunitionKinds[this.kind] ?? "";
    this.spent = this.quantity <= 0;
  }
}
