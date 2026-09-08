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
      // Gentle birth carries a bonus to courtesy and command (p119).
      gentle: new fields.BooleanField({ required: true, initial: false }),
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
      tradition: new fields.StringField({
        required: true,
        initial: "none",
        choices: Object.keys(CNS5.magickTraditions)
      }),
      // The name of the character's Mode of Magick skill. PMF derives from its
      // PSF, so naming the skill is enough — the number follows.
      mode: new fields.StringField({ required: true, blank: true, initial: "" }),
      pmfOverride: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        initial: null
      }),
      resistanceOverride: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        initial: null
      })
    });

    // Coin is held as counts of each denomination rather than a single total,
    // because a purse of 240 pennies and a purse of one pound weigh and spend
    // differently at the table.
    schema.currency = new fields.SchemaField(
      Object.fromEntries(
        Object.keys(CNS5.currency).map((key) => [
          key,
          new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 })
        ])
      )
    );

    schema.faith = new fields.SchemaField({
      // The Faith skill is one of the nine every character has, so PFF derives
      // for everyone, cleric or not.
      skill: new fields.StringField({ required: true, initial: "Faith" }),
      baseSpirit: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      pffOverride: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        initial: null
      })
    });

    return schema;
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    super.prepareDerivedData();

    // Humans add +2 feet to their base Jump (p112).
    if (this.details.race?.toLowerCase() === "human") this.jump += 2;

    this.experience.available = this.experience.earned - this.experience.spent;

    // A single farthing total makes comparisons and change trivial; the sheet
    // still shows and edits the four denominations separately.
    this.currency.totalFarthings = Object.entries(CNS5.currency).reduce(
      (total, [key, coin]) => total + this.currency[key] * coin.inFarthings,
      0
    );

    this.magick.resistance =
      this.magick.resistanceOverride ?? CNS5.magickResistance[this.details.birthOmens] ?? 0;

    this.attributeMax = CNS5.attributeMaximum[this.details.characterType] ?? 20;

    this.#prepareMagick();
    this.#prepareFaith();
    this.#prepareMystical();
  }

  /* -------------------------------------------- */

  /**
   * Personal Magick Factor and Magick Level.
   *
   * PMF is the PSF% in the character's Mode of Magick plus an aspect bonus that
   * runs opposite ways for the two traditions: a mage benefits from being Well
   * or Poorly Aspected, a priest-mage from being Neutral (p288).
   */
  #prepareMagick() {
    const mode = this.parent.items.find(
      (i) => i.type === "skill" && i.name.toLowerCase() === this.magick.mode.toLowerCase()
    );

    this.magick.modeItem = mode ?? null;
    this.magick.modeMissing = Boolean(this.magick.mode) && !mode;
    this.magick.aspectBonus = CNS5.magickAspectBonus(
      this.details.birthOmens,
      this.magick.tradition
    );

    const derived = mode ? mode.system.psf + this.magick.aspectBonus : 0;
    this.magick.pmf = this.magick.pmfOverride ?? derived;
    this.magick.level = this.magick.pmf > 0 ? CNS5.magickLevel(this.magick.pmf) : 0;

    // Starting spell allowance: total levels in Modes of Magick times ML (p295).
    const modeLevels = this.parent.items
      .filter((i) => i.type === "skill" && /mode|magick/i.test(i.name))
      .reduce((total, i) => total + i.system.level, 0);
    this.magick.startingMR = modeLevels * this.magick.level;
  }

  /* -------------------------------------------- */

  /**
   * Personal Faith Factor: half the character's PSF% in Faith, plus base Spirit
   * (worksheet, p145).
   */
  #prepareFaith() {
    const skill = this.parent.items.find(
      (i) => i.type === "skill" && i.name.toLowerCase() === this.faith.skill.toLowerCase()
    );

    this.faith.skillItem = skill ?? null;
    this.faith.skillMissing = !skill;

    const derived = skill ? Math.floor(skill.system.psf / 2) + this.faith.baseSpirit : 0;
    this.faith.pff = this.faith.pffOverride ?? derived;
  }

  /* -------------------------------------------- */

  /**
   * Spells, Acts of Faith and religions all depend on figures computed above,
   * so they are resolved last.
   */
  #prepareMystical() {
    const skills = new Map(
      this.parent.items
        .filter((i) => i.type === "skill")
        .map((i) => [i.name.toLowerCase(), i])
    );

    for (const item of this.parent.items) {
      if (item.type === "spell") {
        // A spell with no Mode named on it falls back to the one its group
        // implies, and failing that to whatever Mode the caster works in — so a
        // spell dragged in from the compendium is castable straight away.
        const wanted = CNS5.spellMode(item.system, this.magick.mode);
        item.system.resolvedMode = wanted;
        item.system.prepareForActor(this, skills.get(wanted.toLowerCase()) ?? null);
      } else if (item.type === "actOfFaith" || item.type === "religion") {
        item.system.prepareForActor(this);
      }
    }
  }
}
