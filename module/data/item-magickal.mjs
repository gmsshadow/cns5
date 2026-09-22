import { CNS5 } from "../config.mjs";
import { CnS5PhysicalItem } from "./item-physical.mjs";

const fields = foundry.data.fields;

/**
 * A Focus or a Device (pp.302-305).
 *
 * Both are made by a mage and carry the mark of their maker's Magick Level:
 * how many charges a Device holds, how much a Focus can store, are fixed at the
 * making and do not change with whoever picks the thing up afterwards. So the
 * maker's level is recorded on the item and everything else follows from it.
 *
 * A Focus is attuned to the mage who made it and is useless to anyone else; a
 * Device may be used by anyone who knows its word of command. That difference
 * is most of why the two are one item type with a kind rather than two.
 */
export class CnS5MagickalItem extends CnS5PhysicalItem {
  static defineSchema() {
    const schema = super.defineSchema();

    schema.kind = new fields.StringField({
      required: true,
      initial: "device",
      choices: ["device", "focus"]
    });

    schema.grade = new fields.StringField({
      required: true,
      initial: "simple",
      choices: ["simple", "lesser", "greater"]
    });

    // Fixed at the making. A Device made by a mage of Magick Level 6 holds the
    // charges a Level 6 mage gives it, whoever carries it later.
    schema.makerMl = new fields.NumberField({
      required: true, integer: true, initial: 1, min: 1
    });

    // A Device casts with its maker's skill, not its bearer's: "the basic
    // chance of casting the spell through a Magickal device is equal to the
    // Method of Magick TSC% of the Magick User who [made it]", targeting is
    // "computed by taking into account the TSC% of the Magick User who created
    // the device", and a victim's save takes "into account the PSF% of the
    // Magick User who created the Magickal device" (p301). So both figures are
    // fixed into the item at its making. That is also why anyone can use one.
    schema.makerTsc = new fields.NumberField({
      required: true, integer: true, initial: 0, min: 0
    });
    schema.makerPsf = new fields.NumberField({
      required: true, integer: true, initial: 0, min: 0
    });

    // The Difficulty Factor of the maker's Method, which sets the bounds his
    // chance is held within. The Methods run from 4 to 6, so it is the maker's
    // own figure rather than one to assume.
    schema.makerDf = new fields.NumberField({
      required: true, integer: true, initial: 5, min: 1, max: 10
    });

    // Recorded as left, rather than worked out, because spending them is the
    // whole of what happens to an item in play.
    schema.charges = new fields.NumberField({
      required: true, integer: true, initial: 0, min: 0
    });

    // A Focus serves only the mage attuned to it.
    schema.attunedTo = new fields.StringField({ required: true, blank: true, initial: "" });

    // The spells a Device holds, by name. Names rather than links, since the
    // spell need not be one its bearer knows — that is the point of a Device.
    schema.spells = new fields.ArrayField(
      new fields.SchemaField({
        name: new fields.StringField({ required: true, blank: false }),
        mr: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        // What the spell would cost from memory. Activating it through the
        // device costs a fraction of this, so it has to be known here: the
        // bearer need not know the spell, and so cannot be asked.
        fp: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        ap: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        rangeText: new fields.StringField({ required: true, blank: true, initial: "" }),
        resisted: new fields.BooleanField({ required: false, nullable: true, initial: null })
      }),
      { required: true, initial: [] }
    );

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const table = this.kind === "focus" ? CNS5.focusGrades : CNS5.deviceGrades;
    this.gradeData = table[this.grade] ?? null;
    this.gradeLabel = this.gradeData?.label ?? "";

    this.maxCharges = CNS5.itemCharges(this.kind, this.grade, this.makerMl);
    this.spent = this.charges <= 0;

    // A Focus stores spells by their Magick Resistance rather than by count.
    if (this.kind === "focus") {
      this.storedMrCapacity = (this.gradeData?.storedMrPerMl ?? 0) * this.makerMl;
    }

    const heldMrs = this.spells.map((s) => s.mr);
    this.heldMr = heldMrs.reduce((total, mr) => total + mr, 0);
    this.accepts =
      this.kind === "device"
        ? CNS5.deviceAccepts(this.grade, heldMrs, this.makerMl)
        : { allowed: true, reason: null };
  }
}
