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

      // "Acts of Faith solely within the competence of ordained priests" are
      // marked †; those open also to monastics and Holy Fighting Orders ‡
      // (p404). So a character's standing in his faith decides what he may
      // invoke, whatever his Personal Faith Factor.
      holyStanding: new fields.StringField({
        required: true,
        initial: "lay",
        choices: Object.keys(CNS5.holyStandings)
      }),
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
    // As with Body and Fatigue, the maximum is declared so that Foundry can see
    // a bar here rather than a bare number.
    schema.spirit = new fields.SchemaField({
      value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      max: new fields.NumberField({ required: true, integer: true, initial: 0 })
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

      // The congregation a clergyman serves, and where. "Acts of Faith...
      // performed for a congregation or for a community... can call upon the
      // Belief of those participating" (p403), which is where the Fatigue for
      // the costlier Acts comes from.
      congregation: new fields.StringField({ required: true, blank: true, initial: "" }),
      holyPlace: new fields.StringField({ required: true, initial: "none" }),
      shrine: new fields.StringField({ required: true, initial: "none" }),
      // What is left of the pool drawn at the last service.
      beliefPool: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
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

    // The Experience Level the total has reached (p45). A skill may be raised
    // to this level at its ordinary cost; past it, every level of the
    // difference is paid for again.
    const progress = CNS5.experienceProgress(this.experience.earned);
    this.experience.level = progress.level;
    this.experience.nextLevelAt = progress.next;
    this.experience.toNextLevel = progress.needed;

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
    // The sign a character was born under, matched from what is written in the
    // field — it has always been free text, so a name typed before this table
    // existed still finds its sign. Two skill categories are favoured by it,
    // and one attribute (p53).
    const written = (this.details.starSign ?? "").trim().toLowerCase();
    this.details.sign =
      Object.keys(CNS5.birthSigns).find((key) => written.startsWith(key)) ?? "";
    const sign = CNS5.birthSigns[this.details.sign] ?? null;

    this.details.favouredCategories = sign?.categories ?? [];
    this.details.favouredAttribute = sign?.attribute ?? "";
    // How many favoured skills the sign grants, which a poor aspect halves.
    this.details.sunsignSkills = sign ? CNS5.sunsignSkills[this.details.birthOmens] ?? 0 : 0;

    this.magick.aspectBonus = CNS5.magickAspectBonus(
      this.details.birthOmens,
      this.magick.tradition
    );

    const derived = mode ? mode.system.psf + this.magick.aspectBonus : 0;
    this.magick.pmf = this.magick.pmfOverride ?? derived;
    this.magick.level = this.magick.pmf > 0 ? CNS5.magickLevel(this.magick.pmf) : 0;

    // Starting spells: "add together the total number of levels the Mage
    // possess in the various Methods of Magick, and multiply the total by the
    // Mage's ML" (p295). Methods, being the schools — the loose match this
    // replaced counted Modes as well, and lore skills besides, so a mage with
    // Magickal Beast Lore bought spells with it.
    const methodLevels = CNS5.knownMethods([...this.parent.items]).reduce(
      (total, skill) => total + skill.system.level,
      0
    );
    this.magick.methodLevels = methodLevels;
    this.magick.startingMR = methodLevels * this.magick.level;
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

    // "Faith does not measure belief in a Deity. That is represented by
    // Spirit" (p400). What his Current Spirit makes of him is read from
    // Table - Perceived Faith, and decides among other things who he may pray
    // for.
    this.faith.believer = CNS5.believerFor(this.spirit.value);

    // "He may raise his Current Spirit by +1 for every 5% PSF (rounded up)."
    // An entitlement he may take, not a gain applied for him — and only in the
    // religion the skill was learnt in.
    this.faith.spiritFromSkill = skill ? CNS5.spiritFromFaith(skill.system.psf) : 0;

    // How many he may pray for besides himself (p403). Office counts for far
    // more than belief, which is the point of ordination.
    this.faith.divineAid = CNS5.divineAidFor({
      believer: this.faith.believer,
      standing: this.details.holyStanding,
      spirit: this.spirit.value,
      priestlyMage: this.magick.tradition === "priestMage"
    });

    // What his congregation and its building would yield, were he to draw on
    // it. Rolled rather than counted, so only the dice are shown.
    this.faith.beliefPoolFormula = CNS5.beliefPoolFormula({
      congregation: this.faith.congregation,
      place: this.faith.holyPlace,
      shrine: this.faith.shrine
    });
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
        // What the spell itself says, or what its group implies. Where neither
        // settles it — the Common Method spells, Healing, the Eldritch groups —
        // the caster's own Methods are consulted, because those spells are cast
        // "with whatever Method the caster has".
        let wanted = CNS5.spellMethod(item.system);
        const known = CNS5.knownMethods([...this.parent.items]);

        if (!wanted) {
          // One Method is no choice at all; several is the caster's to make, so
          // the candidates are carried and the roll asks.
          if (known.length === 1) wanted = known[0].name;
          item.system.methodChoices = known.map((s) => s.name);
        } else {
          item.system.methodChoices = [];
        }
        // Written under the stored name, which is `mode`; everything that
        // reads it does so through `resolvedMethod`, the right word for it.
        item.system.resolvedMode = wanted;
        item.system.prepareForActor(this, skills.get(wanted.toLowerCase()) ?? null);
      } else if (["actOfFaith", "religion", "talent"].includes(item.type)) {
        item.system.prepareForActor(this);
      }
    }
  }
}
