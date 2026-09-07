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
    { id: "omens", number: "3", template: "omens" },
    { id: "identity", number: "4", template: "identity" },
    { id: "background", number: "5-10", template: "background" },
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
      familyStatus: system.details.familyStatus ?? "",
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

    ui.notifications.info(game.i18n.format("CNS5.Creation.done", { name: this.actor.name }));
    await this.close();
    this.actor.sheet.render({ force: true });
  }
}
