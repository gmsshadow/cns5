import { CNS5 } from "../config.mjs";

const { HandlebarsApplicationMixin, ApplicationV2, DialogV2 } = foundry.applications.api;

/**
 * The character creation wizard.
 *
 * It follows the numbered steps of the published worksheet, and keeps those
 * numbers in its headings, so a player working from the paper sheet can see
 * where they are. Nothing is written to the actor until the last step: the
 * wizard holds its own draft, so backing up and changing an early answer
 * cannot leave a half-built character behind.
 *
 * Steps 5 to 10 — social class, father's vocation, sibling rank, family
 * status, the curse, talents and flaws — are collected as free text rather
 * than rolled. Those steps are driven by some forty tables spread across
 * pp.58-101 which have not been extracted, and offering a roll button that
 * produced nothing would be worse than an honest text field.
 */
export class CnS5CreationWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  /* -------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "cns5-creation-wizard",
    classes: ["cns5", "cns5-wizard"],
    position: { width: 680, height: 700 },
    window: { title: "CNS5.Creation.title", resizable: true, contentClasses: ["standard-form"] },
    actions: {
      back: CnS5CreationWizard.#onBack,
      next: CnS5CreationWizard.#onNext,
      rollAttributes: CnS5CreationWizard.#onRollAttributes,
      rollInnate: CnS5CreationWizard.#onRollInnate,
      rollHeight: CnS5CreationWizard.#onRollHeight,
      rollBuild: CnS5CreationWizard.#onRollBuild,
      defaultSize: CnS5CreationWizard.#onDefaultSize,
      rollAge: CnS5CreationWizard.#onRollAge,
      rollSign: CnS5CreationWizard.#onRollSign,
      rollFamily: CnS5CreationWizard.#onRollFamily,
      defaultFamily: CnS5CreationWizard.#onDefaultFamily,
      rollCurse: CnS5CreationWizard.#onRollCurse,
      clearCurses: CnS5CreationWizard.#onClearCurses,
      rollTalents: CnS5CreationWizard.#onRollTalents,
      clearTalents: CnS5CreationWizard.#onClearTalents,
      rollFlaw: CnS5CreationWizard.#onRollFlaw,
      clearFlaws: CnS5CreationWizard.#onClearFlaws,
      defaultAge: CnS5CreationWizard.#onDefaultAge,
      finish: CnS5CreationWizard.#onFinish
    }
  };

  /** @override */
  static PARTS = {
    body: { template: "systems/cns5/templates/wizard/wizard.hbs", scrollable: [".cns5-wizard__step"] }
  };

  /* -------------------------------------------- */

  /**
   * The steps, in worksheet order. `number` is the worksheet's own numbering,
   * which is not sequential here because the wizard groups the background
   * steps together.
   */
  static STEPS = [
    { id: "method", number: "1", template: "method" },
    { id: "horoscope", number: "2", template: "horoscope" },
    { id: "omens", number: "3", template: "omens" },
    { id: "identity", number: "4", template: "identity" },
    { id: "background", number: "5", template: "background" },
    { id: "family", number: "6-7", template: "family" },
    { id: "traits", number: "8-10", template: "traits" },
    { id: "attributes", number: "11", template: "attributes" },
    { id: "size", number: "12", template: "size" },
    { id: "age", number: "18", template: "age" },
    { id: "review", number: "13-17, 19", template: "review" }
  ];

  static PRIMARY = ["str", "con", "dex", "int", "wis", "dis", "app", "bv", "spr"];
  static DERIVED = ["agl", "fer", "cha"];

  /* -------------------------------------------- */

  /**
   * @param {Actor} actor
   * @param {object} [options]
   */
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.index = 0;
    this.draft = CnS5CreationWizard.#blankDraft(actor);
  }

  /* -------------------------------------------- */

  /**
   * A fresh draft, seeded from whatever the actor already has so that running
   * the wizard on a part-built character does not throw work away.
   *
   * @param {Actor} actor
   * @returns {object}
   */
  static #blankDraft(actor) {
    const system = actor.system;
    return {
      name: actor.name === "New Actor" ? "" : actor.name,
      method: "random",
      period: system.details.period ?? "hc",
      characterType: system.details.characterType ?? "historical",
      birthOmens: system.details.birthOmens ?? "neutral",
      gender: system.details.gender ?? "male",
      race: system.details.race ?? "Human",
      nationality: system.details.nationality ?? "",
      socialClass: system.details.socialClass ?? "",
      fathersVocation: system.details.fathersVocation ?? "",
      familyStatus: CNS5.familyStatus.some((f) => f.key === system.details.familyStatus)
        ? system.details.familyStatus
        : CNS5.defaultFamilyStatus,
      // Steps 2 and 6-10, each defaulting to what the book says a character
      // is when the player declines to roll.
      sign: system.details.sign ?? "",
      signRoll: null,
      signChoose: false,
      legitimacy: system.details.legitimacy || "legitimate",
      siblingRank: system.details.siblingRank || CNS5.defaultSiblingRank,
      slave: false,
      heir: false,
      familyRolls: "",
      curses: [],
      curseUuids: [],
      talents: [],
      talentUuids: [],
      talentRoll: "",
      flaws: [],
      flawUuids: [],
      flawRoll: "",
      vocation: system.details.vocation ?? "",
      notes: "",
      attributes: Object.fromEntries(
        CnS5CreationWizard.PRIMARY.map((key) => [key, system.attributes[key].value])
      ),
      innate: Object.fromEntries(
        CnS5CreationWizard.DERIVED.map((key) => [key, system.derived[key].mod])
      ),
      height: system.size.height,
      build: system.size.build,
      weight: system.size.weight,
      age: system.details.age ?? 18,
      experience: system.experience.earned ?? 5000,
      wellAspectedBonus: 0,
      addCoreSkills: true
    };
  }

  /* -------------------------------------------- */

  /** @returns {object} the current step definition */
  get step() {
    return CnS5CreationWizard.STEPS[this.index];
  }

  /**
   * PC Points spent so far, and what is left of the budget.
   *
   * Only the design method has a budget; the rolled methods show the spend as
   * information but are not held to it.
   *
   * @returns {{budget: number, spent: number, left: number, applies: boolean}}
   */
  get points() {
    const draft = this.draft;
    const applies = CNS5.creationMethods[draft.method]?.budget ?? false;
    const budget = CNS5.pcBudget[draft.characterType] ?? 0;

    let spent = 0;
    for (const key of CnS5CreationWizard.PRIMARY) {
      spent += CNS5.attributeCost(draft.attributes[key]);
    }
    for (const key of CnS5CreationWizard.DERIVED) {
      const magnitude = Math.abs(draft.innate[key] ?? 0);
      const row = CNS5.innateModifiers.find((r) => r.magnitude === magnitude);
      spent += row?.cost ?? 0;
    }
    spent += draft.sizePurchases ?? 0;
    spent += draft.ageCost ?? 0;

    // Step 2: choosing a sign outright costs ten (p52). One the dice gave, or
    // the dice gave the right to choose, costs nothing.
    if (draft.sign && !draft.signRoll) spent += CNS5.selectSignCost;

    // Steps 6 and 7: a bastard or a Black Sheep is compensated; buying an
    // elder place or a favourite's standing is paid for (pp.83-84).
    spent -= CNS5.legitimacy.find((l) => l.key === draft.legitimacy)?.pcGained ?? 0;
    spent += CNS5.siblingRankCost[draft.siblingRank] ?? 0;
    spent -= CNS5.familyStatus.find((f) => f.key === draft.familyStatus)?.pcGained ?? 0;

    // Step 8: a curse taken voluntarily is worth five (p84). One the omens
    // forced is not.
    if (draft.curses?.length && !CNS5.curseRequiredFor.includes(draft.birthOmens)) {
      spent -= CNS5.voluntaryCursePoints;
    }

    return { budget, spent, left: budget - spent, applies };
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const draft = this.draft;

    context.draft = draft;
    context.config = CNS5;
    context.step = this.step;
    context.stepTemplate = `systems/cns5/templates/wizard/step-${this.step.template}.hbs`;
    context.steps = CnS5CreationWizard.STEPS.map((s, i) => ({
      ...s,
      label: `CNS5.Creation.step.${s.id}`,
      active: i === this.index,
      done: i < this.index
    }));
    context.isFirst = this.index === 0;
    context.isLast = this.index === CnS5CreationWizard.STEPS.length - 1;
    context.points = this.points;
    context.method = CNS5.creationMethods[draft.method];

    context.methods = this.#choices(CNS5.creationMethods, draft.method);
    context.periods = this.#choices(CNS5.periods, draft.period);
    context.types = this.#choices(CNS5.characterTypes, draft.characterType);
    context.omens = this.#choices(CNS5.birthOmens, draft.birthOmens);

    // Step 2: the sign, and what it inclines towards.
    const labelled = (table) => Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.label]));
    context.signs = this.#choices(labelled(CNS5.birthSigns), draft.sign);
    const sign = CNS5.birthSigns[draft.sign];
    context.signDetail = sign
      ? {
          categories: sign.categories.join(", "),
          attribute: `CNS5.Attr.${sign.attribute}`,
          from: sign.from,
          to: sign.to
        }
      : null;
    // Chosen rather than rolled costs ten; the budget counts it.
    draft.signBought = Boolean(draft.sign) && !draft.signRoll;

    // Steps 6 and 7.
    context.legitimacies = this.#choices(
      Object.fromEntries(CNS5.legitimacy.map((l) => [l.key, `CNS5.Legitimacy.${l.key}`])),
      draft.legitimacy
    );
    context.siblingRanks = [1, 2, 3, 4, 5].map((rank) => ({
      value: rank,
      label: game.i18n.format("CNS5.Creation.childOf", {
        rank,
        cost: CNS5.siblingRankCost[rank]
      }),
      selected: Number(draft.siblingRank) === rank
    }));
    context.familyStatuses = this.#choices(
      Object.fromEntries(CNS5.familyStatus.map((f) => [f.key, `CNS5.FamilyStatus.${f.key}`])),
      draft.familyStatus
    );
    // What the family steps have come to in PC Points: gained for an ill
    // start, spent for a good one.
    context.familyPoints =
      (CNS5.legitimacy.find((l) => l.key === draft.legitimacy)?.pcGained ?? 0) -
      (CNS5.siblingRankCost[draft.siblingRank] ?? 0) +
      (CNS5.familyStatus.find((f) => f.key === draft.familyStatus)?.pcGained ?? 0);

    // Steps 8-10.
    context.curseRequired = CNS5.curseRequiredFor.includes(draft.birthOmens);

    context.attributeRows = CnS5CreationWizard.PRIMARY.map((key) => ({
      key,
      label: `CNS5.Attribute.${key}.long`,
      value: draft.attributes[key],
      bonus: CNS5.attributeBonus(draft.attributes[key]),
      cost: CNS5.attributeCost(draft.attributes[key])
    }));

    context.innateRows = CnS5CreationWizard.DERIVED.map((key) => ({
      key,
      label: `CNS5.Attribute.${key}.long`,
      value: draft.innate[key] ?? 0,
      base: this.#derivedBase(key),
      total: this.#derivedBase(key) + (draft.innate[key] ?? 0)
    }));

    context.attributeMax = CNS5.attributeMaximum[draft.characterType] ?? 20;
    context.sizeTable = this.#sizeTable();
    context.buildBand = CNS5.weightModifiers.find((b) => draft.build <= b.max);
    context.summary = this.#summary();

    return context;
  }

  /* -------------------------------------------- */

  /**
   * The averaged base of a derived attribute, before its innate modifier.
   * @param {string} key
   * @returns {number}
   */
  #derivedBase(key) {
    const rounding = game.settings.get("cns5", "attributeRounding");
    const round = rounding === "nearest" ? Math.round : Math.floor;
    const from = CNS5.derivedAttributes[key].from;
    return round(from.reduce((sum, k) => sum + this.draft.attributes[k], 0) / 3);
  }

  /** The height and build row for the current type and gender. */
  #sizeTable() {
    const byType = CNS5.heightAndBuild[this.draft.characterType] ?? CNS5.heightAndBuild.historical;
    return byType[this.draft.gender === "female" ? "female" : "male"];
  }

  /**
   * Everything the wizard will write, for the review step.
   * @returns {Array<{label: string, value: string}>}
   */
  #summary() {
    const draft = this.draft;
    const build = { ...draft };
    const agl = this.#derivedBase("agl") + (draft.innate.agl ?? 0);
    const fer = this.#derivedBase("fer") + (draft.innate.fer ?? 0);
    const int = draft.attributes.int;

    const weightFactor = CNS5.weightFactor(draft.weight);
    const body = weightFactor + draft.attributes.con + Math.floor(draft.attributes.str / 2);
    const fatigue = draft.attributes.con + Math.max(draft.attributes.str, draft.attributes.dis);
    const lcap = 5 + Math.floor((CNS5.liftingPercent(draft.attributes.str) / 100) * draft.weight);
    const bap = Math.floor(Math.max(agl + Math.min(fer, 20), agl + Math.min(int, 20)) / 2);
    const jump = Math.ceil((draft.attributes.str + agl) / 4) + (draft.race === "Human" ? 2 : 0);

    return [
      { label: "CNS5.Vitals.body", value: `${body}` },
      { label: "CNS5.Vitals.fatigue", value: `${fatigue}` },
      { label: "CNS5.Derived.lcap", value: `${lcap} lb` },
      { label: "CNS5.Derived.ccap", value: `${Math.ceil(lcap / 2)} lb` },
      { label: "CNS5.Derived.bap", value: `${bap}` },
      { label: "CNS5.Derived.jump", value: `${jump} ft` },
      { label: "CNS5.Size.weight", value: `${build.weight} lb` },
      { label: "CNS5.Experience.earned", value: `${draft.experience}` }
    ];
  }

  /**
   * @param {object} source
   * @param {string} selected
   */
  #choices(source, selected) {
    return Object.entries(source).map(([value, entry]) => ({
      value,
      label: typeof entry === "string" ? entry : entry.label,
      selected: value === selected
    }));
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Every input writes straight into the draft, keyed by its name.
    for (const field of this.element.querySelectorAll("[data-draft]")) {
      field.addEventListener("change", (event) => {
        const input = event.currentTarget;
        const path = input.dataset.draft;
        const value =
          input.type === "checkbox"
            ? input.checked
            : input.type === "number"
              ? Number(input.value) || 0
              : input.value;
        foundry.utils.setProperty(this.draft, path, value);
        this.render();
      });
    }
  }

  /* -------------------------------------------- */

  /** @this {CnS5CreationWizard} */
  static #onBack() {
    if (this.index > 0) this.index -= 1;
    this.render();
  }

  /** @this {CnS5CreationWizard} */
  static #onNext() {
    if (this.index < CnS5CreationWizard.STEPS.length - 1) this.index += 1;
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Roll every attribute.
   *
   * Random drops the lowest of three dice, Lion Heart takes two straight. Both
   * add the character type's bonus to each result (p103).
   *
   * @this {CnS5CreationWizard}
   */
  static async #onRollAttributes() {
    const method = this.draft.method;
    if (method === "design") return;

    const bonus = CNS5.typeRollBonus[this.draft.characterType] ?? 0;
    const formula = method === "lionHeart" ? "2d10" : "3d10dl1";

    for (const key of CnS5CreationWizard.PRIMARY) {
      const roll = await new Roll(formula).evaluate();
      this.draft.attributes[key] = roll.total + bonus;
    }
    this.render();
  }

  /**
   * Roll the innate ability modifier for one derived attribute. The roll gives
   * a magnitude; the sign stays the player's to set (p103).
   *
   * @this {CnS5CreationWizard}
   */
  static async #onRollInnate(event, target) {
    const key = target.dataset.attribute;
    if (!key) return;

    const roll = await new Roll("1d10").evaluate();
    const row = CNS5.innateModifiers.find((r) => roll.total <= r.roll);
    this.draft.innate[key] = row.magnitude;
    this.render();
  }

  /* -------------------------------------------- */

  /** @this {CnS5CreationWizard} */
  static async #onRollHeight() {
    const table = this.#sizeTable();
    const roll = await new Roll("2d10").evaluate();
    this.draft.height = roll.total + table.heightMod;
    this.draft.weight = CNS5.weightFor(this.draft.height, this.draft.build);
    this.render();
  }

  /** @this {CnS5CreationWizard} */
  static async #onRollBuild() {
    const table = this.#sizeTable();
    const roll = await new Roll("1d10").evaluate();
    const agl = this.#derivedBase("agl") + (this.draft.innate.agl ?? 0);
    this.draft.build =
      roll.total + table.buildMod + CNS5.buildAdjustment(agl, this.draft.attributes.con);
    this.draft.weight = CNS5.weightFor(this.draft.height, this.draft.build);
    this.render();
  }

  /** @this {CnS5CreationWizard} */
  static #onDefaultSize() {
    const table = this.#sizeTable();
    this.draft.height = table.defaultHeight;
    this.draft.build = table.defaultBuild;
    this.draft.weight = CNS5.weightFor(this.draft.height, this.draft.build);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Roll starting age and experience. A Well Aspected character adds 1% per
   * point of a d10 to their experience (p114).
   *
   * @this {CnS5CreationWizard}
   */
  static async #onRollAge() {
    const roll = await new Roll("1d100").evaluate();
    const band = CNS5.startingAge.find((b) => roll.total <= b.max) ?? CNS5.defaultAgeBand;
    const race = this.draft.race.toLowerCase();
    const key = race.includes("dwarf") ? "dwarf" : race.includes("elf") ? "elf" : "human";

    this.draft.age = band[key];
    this.draft.experience = band.exp;
    this.draft.ageCost = band.cost;

    if (this.draft.birthOmens === "well") {
      const bonus = await new Roll("1d10").evaluate();
      this.draft.wellAspectedBonus = bonus.total;
      this.draft.experience = Math.round(band.exp * (1 + bonus.total / 100));
    }
    this.render();
  }

  /** @this {CnS5CreationWizard} */
  static #onDefaultAge() {
    const band = CNS5.defaultAgeBand;
    const race = this.draft.race.toLowerCase();
    const key = race.includes("dwarf") ? "dwarf" : race.includes("elf") ? "elf" : "human";
    this.draft.age = band[key];
    this.draft.experience = band.exp;
    this.draft.ageCost = 0;
    this.draft.wellAspectedBonus = 0;
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Write the draft to the actor.
   *
   * @this {CnS5CreationWizard}
   */
  /* -------------------------------------------- */
  /*  Step 2: the horoscope (p52)                 */
  /* -------------------------------------------- */

  /**
   * "97 -100 Select Sign" — so a roll may give a sign or the right to choose
   * one. Choosing without the roll costs ten PC Points.
   */
  static async #onRollSign() {
    const roll = await new Roll("1d100").evaluate();
    this.draft.signRoll = roll.total;
    const sign = CNS5.birthSignFor(roll.total);
    this.draft.signChoose = !sign;
    if (sign) this.draft.sign = sign;
    this.render();
  }

  /* -------------------------------------------- */
  /*  Steps 6 and 7: family (pp.82-84)            */
  /* -------------------------------------------- */

  /** Legitimacy, place among the siblings, and standing with the family. */
  static async #onRollFamily() {
    const d = this.draft;
    const legit = await new Roll("1d100").evaluate();
    const rank = await new Roll("1d10").evaluate();
    const status = await new Roll("1d100").evaluate();

    // "Children of slaves suffer a -65% penalty on this roll" — which can
    // take it below the table, and is read as its lowest row.
    const legitValue = Math.max(1, legit.total + (d.slave ? CNS5.slaveLegitimacyPenalty : 0));
    d.legitimacy = CNS5.readRoll(CNS5.legitimacy, legitValue).key;
    d.siblingRank = CNS5.siblingRankFor(rank.total);
    const statusValue = status.total + (d.heir ? CNS5.heirFamilyBonus : 0);
    d.familyStatus = CNS5.readRoll(CNS5.familyStatus, statusValue).key;

    d.familyRolls = game.i18n.format("CNS5.Creation.familyRolled", {
      legit: legitValue,
      rank: rank.total,
      status: statusValue
    });
    this.render();
  }

  /** The book's default: youngest of five legitimate children, a credit to them. */
  static async #onDefaultFamily() {
    Object.assign(this.draft, {
      legitimacy: "legitimate",
      siblingRank: CNS5.defaultSiblingRank,
      familyStatus: CNS5.defaultFamilyStatus,
      familyRolls: ""
    });
    this.render();
  }

  /* -------------------------------------------- */
  /*  Steps 8-10: curse, talents, flaws           */
  /* -------------------------------------------- */

  /**
   * The flaws compendium, split by what each entry is: curses, allergies,
   * phobias and ordinary flaws are all flaws, rolled on their own tables.
   * @returns {Promise<object>}
   */
  async #traitTables() {
    if (this.#tables) return this.#tables;
    const flaws = (await game.packs.get("cns5.flaws")?.getDocuments()) ?? [];
    const talents = (await game.packs.get("cns5.talents")?.getDocuments()) ?? [];
    const of = (kind) => flaws.filter((f) => f.system.kind === kind);
    this.#tables = {
      curse: of("curse"),
      allergy: of("allergy"),
      phobia: of("phobia"),
      deficiency: of("deficiency"),
      talent: talents
    };
    return this.#tables;
  }

  #tables = null;

  /**
   * An entry from a table, by a roll of its die.
   * @returns {Item|null}
   */
  static #entryFor(entries, roll) {
    return entries.find((e) => roll >= e.system.roll.min && roll <= e.system.roll.max) ?? null;
  }

  /**
   * Roll one curse, following it where it says to go: an allergy to Table -
   * Allergies, a phobia to Table - Phobias, and "twice cursed" or "thrice
   * cursed" back to the curses themselves (pp.84-87).
   *
   * @param {object} tables
   * @param {number} depth  guards against a run of "roll again"
   */
  async #rollOneCurse(tables, depth = 0) {
    const roll = (await new Roll("1d100").evaluate()).total;
    const curse = CnS5CreationWizard.#entryFor(tables.curse, roll);
    if (!curse) return;

    const again = { "Twice Cursed": 2, "Thrice Cursed": 3 }[curse.name];
    if (again && depth < 3) {
      for (let i = 0; i < again; i++) await this.#rollOneCurse(tables, depth + 1);
      return;
    }

    this.#take("curses", "curseUuids", curse, roll);
    if (/Allergy/.test(curse.name)) {
      const d10 = (await new Roll("1d10").evaluate()).total;
      const allergy = CnS5CreationWizard.#entryFor(tables.allergy, d10);
      if (allergy) this.#take("curses", "curseUuids", allergy, d10);
    } else if (/Phobia/.test(curse.name)) {
      const d100 = (await new Roll("1d100").evaluate()).total;
      const phobia = CnS5CreationWizard.#entryFor(tables.phobia, d100);
      if (phobia) this.#take("curses", "curseUuids", phobia, d100);
    }
  }

  /** Record a rolled entry, by name for the page and by UUID for the finish. */
  #take(names, uuids, entry, roll) {
    this.draft[names].push(`${entry.name} (${roll})`);
    this.draft[uuids].push(entry.uuid);
  }

  static async #onRollCurse() {
    await this.#rollOneCurse(await this.#traitTables());
    this.render();
  }

  static async #onClearCurses() {
    this.draft.curses = [];
    this.draft.curseUuids = [];
    this.render();
  }

  /**
   * Table - Special Abilities Outcomes, then a roll on the talents for each
   * one it gives (p88). A hundred lets the player choose, which is left to
   * him.
   */
  static async #onRollTalents() {
    const tables = await this.#traitTables();
    const roll = (await new Roll("1d100").evaluate()).total;
    const outcome = CNS5.talentOutcomes.find((o) => roll <= o.max);

    this.draft.talents = [];
    this.draft.talentUuids = [];

    if (outcome.choose) {
      this.draft.talentRoll = game.i18n.format("CNS5.Creation.talentChoose", { roll });
    } else {
      for (let i = 0; i < outcome.count; i++) {
        const d100 = (await new Roll("1d100").evaluate()).total;
        const talent = CnS5CreationWizard.#entryFor(tables.talent, d100);
        if (talent) this.#take("talents", "talentUuids", talent, d100);
      }
      this.draft.talentRoll = game.i18n.format("CNS5.Creation.talentCount", {
        roll,
        count: outcome.count
      });
    }
    this.render();
  }

  static async #onClearTalents() {
    Object.assign(this.draft, { talents: [], talentUuids: [], talentRoll: "" });
    this.render();
  }

  /**
   * "Roll 1D100 if the roll is 01-40% the character possess a flaw. This is
   * compulsory if a character has any special talents" (p94). Once, however
   * many talents.
   */
  static async #onRollFlaw() {
    const tables = await this.#traitTables();
    const roll = (await new Roll("1d100").evaluate()).total;

    this.draft.flaws = [];
    this.draft.flawUuids = [];

    if (roll <= CNS5.flawChance) {
      const d100 = (await new Roll("1d100").evaluate()).total;
      const flaw = CnS5CreationWizard.#entryFor(tables.deficiency, d100);
      if (flaw) this.#take("flaws", "flawUuids", flaw, d100);
      this.draft.flawRoll = game.i18n.format("CNS5.Creation.flawGained", { roll });
    } else {
      this.draft.flawRoll = game.i18n.format("CNS5.Creation.flawEscaped", { roll });
    }
    this.render();
  }

  static async #onClearFlaws() {
    Object.assign(this.draft, { flaws: [], flawUuids: [], flawRoll: "" });
    this.render();
  }

  /* -------------------------------------------- */

  static async #onFinish() {
    const points = this.points;
    if (points.applies && points.left < 0) {
      const proceed = await DialogV2.confirm({
        window: { title: game.i18n.localize("CNS5.Creation.overspentTitle") },
        content: `<p>${game.i18n.format("CNS5.Creation.overspent", { over: -points.left })}</p>`
      });
      if (!proceed) return;
    }

    const draft = this.draft;
    const update = {
      "system.details.period": draft.period,
      "system.details.characterType": draft.characterType,
      "system.details.birthOmens": draft.birthOmens,
      "system.details.gender": draft.gender,
      "system.details.race": draft.race,
      "system.details.nationality": draft.nationality,
      "system.details.socialClass": draft.socialClass,
      "system.details.fathersVocation": draft.fathersVocation,
      "system.details.familyStatus": draft.familyStatus,
      "system.details.starSign": draft.sign ? game.i18n.localize(CNS5.birthSigns[draft.sign].label) : "",
      "system.details.legitimacy": draft.legitimacy,
      "system.details.siblingRank": Number(draft.siblingRank) || CNS5.defaultSiblingRank,
      "system.details.vocation": draft.vocation,
      "system.details.age": draft.age,
      "system.size.height": draft.height,
      "system.size.build": draft.build,
      "system.size.weight": draft.weight,
      "system.experience.earned": draft.experience
    };
    if (draft.name?.trim()) update.name = draft.name.trim();
    if (draft.notes?.trim()) update["system.details.familyNotes"] = `<p>${draft.notes.trim()}</p>`;

    for (const key of CnS5CreationWizard.PRIMARY) {
      update[`system.attributes.${key}.value`] = draft.attributes[key];
    }
    for (const key of CnS5CreationWizard.DERIVED) {
      update[`system.derived.${key}.mod`] = draft.innate[key] ?? 0;
    }

    await this.actor.update(update);

    if (draft.addCoreSkills) {
      await this.actor.addCoreSkills();
      // Accurate Counting comes free to anyone of Intellect 12 or better
      // (worksheet, Vocation and Skills).
      if (draft.attributes.int >= 12) await this.actor.addAccurateCounting();
    }

    // What the dice gave him: curses, talents and flaws, copied from the
    // compendia so they carry their page and their roll. Anything he already
    // has by the same name is not given twice, so running the wizard again on
    // a part-built character does not stack them.
    const uuids = [...draft.curseUuids, ...draft.talentUuids, ...draft.flawUuids];
    if (uuids.length) {
      const held = new Set(this.actor.items.map((i) => `${i.type}:${i.name}`));
      const items = [];
      for (const uuid of uuids) {
        const source = await fromUuid(uuid);
        if (!source || held.has(`${source.type}:${source.name}`)) continue;
        held.add(`${source.type}:${source.name}`);
        items.push(source.toObject());
      }
      if (items.length) await this.actor.createEmbeddedDocuments("Item", items);
    }

    ui.notifications.info(game.i18n.format("CNS5.Creation.done", { name: this.actor.name }));
    await this.close();
    this.actor.sheet.render({ force: true });
  }
}
