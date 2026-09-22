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

    // A Device holds spells and charges; a Focus is an aid the mage casts his
    // own spells through, and stores a few besides; a Scroll carries a single
    // spell and is spent the moment it is read.
    schema.kind = new fields.StringField({
      required: true,
      initial: "device",
      choices: ["device", "focus", "scroll"]
    });

    // A Scroll crumbles once read, hit or miss. It is kept, greyed, rather than
    // deleted: a thing that has just happened at the table is worth being able
    // to see, and the player can throw it away.
    schema.discharged = new fields.BooleanField({ required: true, initial: false });

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

    const table = {
      focus: CNS5.focusGrades,
      device: CNS5.deviceGrades,
      scroll: CNS5.scrollGrades
    }[this.kind];
    this.gradeData = table?.[this.grade] ?? null;
    this.gradeLabel = this.gradeData?.label ?? "";

    // A Scroll has no charges: it is used once.
    this.maxCharges =
      this.kind === "scroll" ? 0 : CNS5.itemCharges(this.kind, this.grade, this.makerMl);
    this.spent = this.kind === "scroll" ? this.discharged : this.charges <= 0;

    // A Focus stores spells by their Magick Resistance rather than by count.
    if (this.kind === "focus") {
      this.storedMrCapacity = (this.gradeData?.storedMrPerMl ?? 0) * this.makerMl;
    }

    const heldMrs = this.spells.map((s) => s.mr);
    this.heldMr = heldMrs.reduce((total, mr) => total + mr, 0);

    if (this.kind === "device") {
      this.accepts = CNS5.deviceAccepts(this.grade, heldMrs, this.makerMl);
    } else if (this.kind === "scroll") {
      // One spell, of the grade's band of Magick Resistance.
      this.accepts =
        this.spells.length > 1
          ? { allowed: false, reason: "CNS5.Scroll.onlyOne" }
          : this.spells.length && !CNS5.scrollAccepts(this.grade, this.spells[0].mr)
            ? { allowed: false, reason: "CNS5.Scroll.wrongGrade" }
            : { allowed: true, reason: null };
    } else {
      // A Focus stores by total Magick Resistance rather than by count.
      this.accepts =
        this.heldMr > (this.storedMrCapacity ?? 0)
          ? { allowed: false, reason: "CNS5.Focus.overStore" }
          : { allowed: true, reason: null };
    }

    // Whatever holds spells can have them cast from it; a spent one cannot.
    this.castable = this.spells.length > 0 && !this.spent;
  }
}
