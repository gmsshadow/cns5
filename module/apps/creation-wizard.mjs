import { CNS5 } from "../config.mjs";
import {
  parseBackgroundSkills,
  rollFathersVocation,
  rollChivalricBackground,
  rollOutsiderBackground
} from "../helpers/background.mjs";
import {
  resolveVocation,
  indexSkills,
  classifySkills,
  vocationalOptions,
  startingSkills,
  checkStartingSkills,
  freeMasteryFor
} from "../helpers/vocations.mjs";
import { CnS5StartingSpells } from "./starting-spells.mjs";

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
      rollSocialClass: CnS5CreationWizard.#onRollSocialClass,
      rollFathersVocation: CnS5CreationWizard.#onRollFathersVocation,
      defaultSocialClass: CnS5CreationWizard.#onDefaultSocialClass,
      rollFamily: CnS5CreationWizard.#onRollFamily,
      defaultFamily: CnS5CreationWizard.#onDefaultFamily,
      rollCurse: CnS5CreationWizard.#onRollCurse,
      clearCurses: CnS5CreationWizard.#onClearCurses,
      rollTalents: CnS5CreationWizard.#onRollTalents,
      clearTalents: CnS5CreationWizard.#onClearTalents,
      rollFlaw: CnS5CreationWizard.#onRollFlaw,
      clearFlaws: CnS5CreationWizard.#onClearFlaws,
      defaultAge: CnS5CreationWizard.#onDefaultAge,
      togglePick: CnS5CreationWizard.#onTogglePick,
      clearVocation: CnS5CreationWizard.#onClearVocation,
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
    { id: "vocation", number: "V", template: "vocation" },
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
    // What an earlier run of the wizard added for class — a peasant's
    // Strength, a townsman's Agility — is taken off again, so that running it
    // twice does not add it twice.
    const given = actor.getFlag?.("cns5", "classBonuses") ?? {};
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
      // Step 5a: the class and where in it, defaulting as the book does to an
      // Average Freeman or Townsman.
      socialClassKey: system.details.socialClassKey || CNS5.defaultSocialClass.key,
      socialBand: system.details.socialBand || CNS5.defaultSocialClass.band,
      socialRolls: "",
      fathersVocation: system.details.fathersVocation ?? "",
      // Step 5b: what the father's vocation gave, kept so the skills can be
      // granted when the wizard finishes.
      fatherSkills: "",
      fatherStatus: system.details.socialStatus ?? "",
      fatherGrants: [],
      fatherLabourer: false,
      fatherRolls: "",
      fatherNote: "",
      // A chivalric father: whether his son reads, and at what Intellect, is
      // settled when the attributes are known (p78). The scholarly option
      // replaces Basic Chivalric Training for a son who is not the heir (p77).
      fatherReadingInt: null,
      scholarly: false,
      // An outsider is a Jew, a slave or some other minority (p60); a slave
      // of the later periods has a table only around the Mediterranean.
      outsiderKind: "jew",
      mediterranean: false,
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
      // The vocation and the starting skills (pp.119-146). The picks, the
      // masteries in the order chosen, and the rest are skill names as the
      // skills list gives them.
      vocationKey: system.details.vocationKey ?? "",
      vocationVariant: system.details.vocationVariant ?? "",
      picks: [],
      masteries: [],
      tertiary: [],
      sunsignSkills: [],
      raises: [],
      // Skills the father's vocation leaves to choice — "+1 Skill", "2 Lore"
      // — keyed by the choice's place in the row; and a Forester's son's four
      // Outdoor skills (p124).
      backgroundPicks: {},
      fatherOutdoor: [],
      notes: "",
      attributes: Object.fromEntries(
        CnS5CreationWizard.PRIMARY.map((key) => [key, system.attributes[key].value - (given[key] ?? 0)])
      ),
      innate: Object.fromEntries(
        CnS5CreationWizard.DERIVED.map((key) => [key, system.derived[key].mod - (given[key] ?? 0)])
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

    // Step 5a: a poor class is compensated, a high one paid for (p60).
    spent -= CnS5CreationWizard.#classPoints(draft);

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

    // Step 5a.
    const table = CNS5.socialClasses[draft.period] ?? CNS5.socialClasses.hc;
    context.socialClasses = this.#choices(
      Object.fromEntries(table.map((c) => [c.key, `CNS5.SocialClass.${c.key}`])),
      draft.socialClassKey
    );
    const cls = table.find((c) => c.key === draft.socialClassKey);
    // A band from the class chosen before this one means nothing here; the
    // class's own average is taken instead, or its first band.
    if (cls?.bands && !cls.bands.some((b) => b.key === draft.socialBand)) {
      draft.socialBand = (cls.bands.find((b) => b.key === "average") ?? cls.bands[0]).key;
    } else if (cls && !cls.bands) {
      draft.socialBand = "";
    }
    context.socialBands = (cls?.bands ?? []).map((b) => ({
      value: b.key,
      label: `${game.i18n.localize(`CNS5.SocialBand.${b.key}`)} (${b.pcGained > 0 ? "+" : ""}${b.pcGained || "—"})`,
      selected: b.key === draft.socialBand
    }));
    context.classPoints = CnS5CreationWizard.#classPoints(draft);
    context.isPeasant = CNS5.peasantClasses.includes(draft.socialClassKey);
    context.isOutsider = draft.socialClassKey === "outsider";

    // Step 5b: the father's vocation, and what it gives him.
    const background = await CnS5CreationWizard.#backgroundData();
    context.isChivalric = draft.socialClassKey === "chivalric";
    context.outsiderKinds = this.#choices(
      Object.fromEntries(CNS5.outsiderKinds.map((k) => [k, `CNS5.Outsider.${k}`])),
      draft.outsiderKind
    );
    context.askMediterranean = context.isOutsider && draft.outsiderKind === "slave" && draft.period !== "ef";
    context.vocationTable =
      context.isChivalric ||
      (context.isOutsider && draft.outsiderKind !== "other") ||
      Boolean(background.vocations.classes?.[draft.socialClassKey]?.[draft.socialBand]);
    context.fatherSkills = draft.fatherSkills
      ? parseBackgroundSkills(draft.fatherSkills, background.resolve)
      : null;
    context.isTownsman = draft.socialClassKey === "townsman";

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

    if (this.step.id === "vocation") Object.assign(context, this.#vocationContext(background));

    return context;
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  The vocation and its skills (pp.119-146)    */
  /* -------------------------------------------- */

  /**
   * The groups a background choice draws from. "Lore" names no one group in
   * the skills list; it is both kinds of lore.
   * @param {string|null} category
   * @returns {string[]|null}  null for any skill at all
   */
  static #choiceGroups(category) {
    if (!category) return null;
    if (category === "Lore") return ["Lore Historical", "Lore Scientific"];
    return [category];
  }

  /**
   * Every skill the character knows before choosing his vocational skills,
   * and at what level: the core skills, his class's, his father's and those
   * chosen among them. This is what the finish grants as background, read
   * the same way, so that what the step shows is what the sheet will get.
   *
   * @param {object} bg   the loaded data
   * @param {object} voc  the vocation, for a Forester's son (p124)
   * @returns {Map<string, number>}
   */
  #knownBackground(bg, voc) {
    const draft = this.draft;
    const known = new Map();
    const add = (name, level = 0) => {
      const n = bg.resolve(name) ?? name;
      if (!bg.index.has(n)) return;
      known.set(n, Math.max(known.get(n) ?? 0, level));
    };

    if (draft.addCoreSkills) {
      for (const name of CNS5.coreBackgroundSkills) add(name);
      if (draft.attributes.int >= 12) add("Accurate Counting");
    }
    if (CNS5.peasantClasses.includes(draft.socialClassKey)) {
      for (const skill of CNS5.peasantBenefits.skills) add(skill.name, skill.level);
    }
    if (draft.fatherSkills) {
      const parsed = parseBackgroundSkills(draft.fatherSkills, bg.resolve);
      for (const skill of parsed.named) add(skill.name, skill.level);
      parsed.choices.forEach((choice, i) => {
        for (const name of Object.values(draft.backgroundPicks?.[i] ?? {})) if (name) add(name);
      });
    }
    for (const name of draft.fatherGrants ?? []) add(name);
    if (draft.fatherLabourer) for (const skill of CNS5.labourerSkills) add(skill.name, skill.level);

    if (draft.socialClassKey === "chivalric") {
      const int = draft.attributes.int ?? 0;
      if (draft.fatherReadingInt && int >= draft.fatherReadingInt) add(CNS5.readingSkill);
      if (draft.scholarly) {
        for (const lang of CNS5.scholarlyLanguages) if (lang.skill && int >= lang.int) add(lang.skill);
      }
    }

    // "If the PC's father's vocation is a Forester, the character will start
    // with background knowledge in any four Outdoor Skills" and "basic
    // knowledge in these athletic skills" (p124).
    if (this.#foresterSon(voc)) {
      for (const name of voc.fatherBonus.skills) add(name);
      for (const name of Object.values(draft.fatherOutdoor ?? {})) if (name) add(name);
    }
    return known;
  }

  /** Whether the vocation's father bonus applies to this character. */
  #foresterSon(voc) {
    const bonus = voc?.fatherBonus;
    return Boolean(bonus) && new RegExp(bonus.father, "i").test(this.draft.fathersVocation ?? "");
  }

  /**
   * The attributes a vocation's rules read, derived ones included.
   * @returns {object}
   */
  #allAttributes() {
    const draft = this.draft;
    const out = { ...draft.attributes };
    for (const key of CnS5CreationWizard.DERIVED) out[key] = this.#derivedBase(key) + (draft.innate[key] ?? 0);
    return out;
  }

  /**
   * The draft's vocational choices, in the shape the vocation helpers take.
   * @param {object} bg
   * @returns {object|null}
   */
  #vocationState(bg) {
    const draft = this.draft;
    const voc = resolveVocation(bg.callings, draft.vocationKey, draft.vocationVariant);
    if (!voc) return null;
    const slots = (list) => (list ?? []).filter(Boolean);
    return {
      voc,
      picks: slots(draft.picks),
      masteries: slots(draft.masteries),
      tertiary: slots(draft.tertiary),
      sunsign: slots(draft.sunsignSkills),
      raises: slots(draft.raises),
      background: this.#knownBackground(bg, voc),
      gentle: draft.socialClassKey === "chivalric",
      attributes: this.#allAttributes(),
      sign: draft.sign,
      signAspect: draft.birthOmens,
      raiseAllowance: CNS5.classSkillRaises(draft.socialClassKey, draft.socialBand, draft.fathersVocation)
    };
  }

  /**
   * Everything the vocation step shows.
   * @param {object} bg
   * @returns {object}
   */
  #vocationContext(bg) {
    const draft = this.draft;
    const order = ["warrior", "thief", "other", "mage", "priestMage", "priest", "adventurer"];
    const vocationGroups = order.map((group) => ({
      label: `CNS5.Vocation.group.${group}`,
      options: bg.callings.vocations
        .filter((v) => v.group === group)
        .map((v) => ({ value: v.key, label: v.name, selected: v.key === draft.vocationKey }))
    }));

    const state = this.#vocationState(bg);
    if (!state) return { vocationGroups, voc: null };
    const { voc } = state;
    const ctx = { index: bg.index, filters: bg.callings.filters };
    const background = new Set(state.background.keys());
    const skills = startingSkills(state, ctx);
    const byName = new Map(skills.map((s) => [s.name, s]));
    const categoryLabel = (c) => `CNS5.SkillCategory.${c}`;

    // The skills the vocation offers, by group, ticked where taken.
    const offered = vocationalOptions(voc, { ...ctx, background });
    const names = new Set(offered.map((o) => o.name));
    for (const name of state.picks) {
      if (!names.has(name) && bg.index.has(name)) {
        offered.push({ name, group: bg.index.get(name).group, category: "tertiary" });
      }
    }
    const groups = new Map();
    for (const o of offered) {
      const now = byName.get(o.name)?.category ?? o.category;
      const row = {
        name: o.name,
        category: now,
        categoryLabel: categoryLabel(now),
        picked: state.picks.includes(o.name),
        known: state.background.has(o.name),
        level: byName.get(o.name)?.level ?? 0
      };
      if (!groups.has(o.group)) groups.set(o.group, []);
      groups.get(o.group).push(row);
    }
    const optionGroups = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, rows]) => ({ group, rows: rows.sort((a, b) => a.name.localeCompare(b.name)) }));

    const picked = state.picks.map((n) => byName.get(n)).filter(Boolean);
    const count = (c) => picked.filter((s) => s.category === c).length;

    // Slots: a select per mastery, tertiary skill, Sunsign skill and raise.
    const slot = (path, value, options, number) => ({
      path,
      number,
      value: value ?? "",
      options: [...options].sort((a, b) => a.localeCompare(b))
    });
    const slots = (key, n, options) =>
      Array.from({ length: n }, (_, i) => slot(`${key}.${i}`, draft[key]?.[i], options, i + 1));

    const knownNames = new Set([...state.picks, ...background, ...state.tertiary]);
    const allNames = [...bg.index.keys()];
    const vocational = new Set(offered.filter((o) => o.category !== "tertiary").map((o) => o.name));

    const tertiaryAllowance = CNS5.tertiarySkillsFor((draft.attributes.int ?? 0) + (draft.attributes.dis ?? 0));
    const sign = CNS5.birthSigns[draft.sign];
    const sunsignCount = sign ? CNS5.sunsignSkills[draft.birthOmens] ?? CNS5.sunsignSkills.neutral : 0;
    const favoured = sign ? allNames.filter((n) => sign.categories.includes(bg.index.get(n).group)) : [];

    // The father's choices, each a select per skill owed.
    const parsed = draft.fatherSkills ? parseBackgroundSkills(draft.fatherSkills, bg.resolve) : null;
    const backgroundChoices = (parsed?.choices ?? []).map((choice, i) => {
      const groupsFor = CnS5CreationWizard.#choiceGroups(choice.category);
      const options = choice.options?.length
        ? choice.options.map((o) => bg.resolve(o) ?? o).filter((o) => bg.index.has(o))
        : allNames.filter((n) => !groupsFor || groupsFor.includes(bg.index.get(n).group));
      return {
        label: choice.label,
        slots: Array.from({ length: choice.count || 1 }, (_, j) =>
          slot(`backgroundPicks.${i}.${j}`, draft.backgroundPicks?.[i]?.[j], options)
        )
      };
    });
    const outdoor = allNames.filter((n) => bg.index.get(n).group === "Outdoor");

    const attributes = state.attributes;
    const primaryAttr = voc.attributes.primary;
    const secondaryAttr = voc.attributes.secondary;
    const masteryTotal = primaryAttr && secondaryAttr
      ? CNS5.masteryTotal({ primary: attributes[primaryAttr], secondary: attributes[secondaryAttr], dis: attributes.dis })
      : null;

    return {
      vocationGroups,
      voc,
      variants: voc.variants.map((v) => ({ value: v.key, label: v.name, selected: v.key === voc.variant })),
      attributeLabels: {
        primary: primaryAttr ? `CNS5.Attribute.${primaryAttr}.long` : null,
        secondary: secondaryAttr ? `CNS5.Attribute.${secondaryAttr}.long` : null
      },
      primaryEntries: voc.primary.map((e) => e.text).join("; "),
      secondaryEntries: voc.secondary.map((e) => e.text).join("; "),
      masteryOrder: voc.masteryOrder.map((step, i) => `${i + 1}. ${step.map((r) => r.text).join(" + ")}`),
      masteryInterval: masteryTotal == null ? null : CNS5.masteryIntervalFor(masteryTotal),
      masteryTotal,
      freeMastery: freeMasteryFor(voc, state),
      optionGroups,
      pickCounts: {
        total: state.picks.length,
        primary: count("primary"),
        secondary: count("secondary"),
        want: CNS5.startingSkills.count
      },
      masterySlots: slots("masteries", CNS5.startingSkills.masteries, knownNames),
      tertiarySlots: slots("tertiary", tertiaryAllowance, allNames.filter((n) => !vocational.has(n))),
      sunsignSlots: slots("sunsignSkills", sunsignCount, favoured),
      raiseSlots: slots("raises", state.raiseAllowance, background),
      backgroundChoices,
      fatherOutdoor: this.#foresterSon(voc)
        ? Array.from({ length: voc.fatherBonus.choose.count }, (_, i) =>
            slot(`fatherOutdoor.${i}`, draft.fatherOutdoor?.[i], outdoor)
          )
        : [],
      signCategories: sign?.categories.join(", ") ?? "",
      problems: checkStartingSkills(state, ctx).map((p) =>
        game.i18n.format(`CNS5.Vocation.problem.${p.key}`, p.data)
      ),
      startingSkills: skills
        .filter((s) => s.level > 0 || s.mastered || state.tertiary.includes(s.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({ ...s, categoryLabel: categoryLabel(s.category) }))
    };
  }

  /**
   * The vocation as the sheet shows it: the table's name and kind, or what
   * the player wrote for an Adventurer or a vocation of his own.
   * @returns {string}
   */
  #vocationLabel() {
    const draft = this.draft;
    const bg = CnS5CreationWizard.#background;
    const voc = bg ? resolveVocation(bg.callings, draft.vocationKey, draft.vocationVariant) : null;
    if (!voc || voc.custom) return draft.vocation || voc?.name || "";
    return voc.variantName ? `${voc.name} (${voc.variantName})` : voc.name;
  }

  /** Take a skill as one of the ten, or put it back. */
  static #onTogglePick(event, target) {
    const name = target.dataset.skill;
    if (!name) return;
    const picks = new Set(this.draft.picks);
    if (picks.has(name)) picks.delete(name);
    else picks.add(name);
    this.draft.picks = [...picks];
    this.render();
  }

  /** Clear every vocational choice, keeping the vocation. */
  static #onClearVocation() {
    Object.assign(this.draft, { picks: [], masteries: [], tertiary: [], sunsignSkills: [], raises: [] });
    this.render();
  }

  /**
   * The skill the character already has under this name — or, for a core
   * skill, under the name the core skills are created with.
   * @param {string} name  as the skills list gives it
   * @returns {Item|undefined}
   */
  #skillItem(name) {
    const core = CNS5.coreSkills.find((c) => c.listName === name)?.name;
    const wanted = [name, core].filter(Boolean).map((n) => n.toLowerCase());
    return this.actor.items.find((i) => i.type === "skill" && wanted.includes(i.name.toLowerCase()));
  }

  /**
   * Write the starting skills: each at its level and category, mastered or
   * not. Nothing is lowered, so running the wizard again on a character who
   * has since advanced keeps his advances.
   */
  async #applyVocation() {
    const bg = await CnS5CreationWizard.#backgroundData();
    const state = this.#vocationState(bg);
    if (!state) return;
    const ctx = { index: bg.index, filters: bg.callings.filters };

    const updates = [];
    for (const skill of startingSkills(state, ctx)) {
      // An Elementalist's Mode is named for his element (p295).
      const renamed = skill.name === state.voc.mode && state.voc.modeName !== state.voc.mode
        ? state.voc.modeName
        : null;
      let item = (renamed && this.#skillItem(renamed)) || this.#skillItem(skill.name);
      const created = !item;
      if (created) item = await this.actor.grantSkill(skill.name);
      if (!item) continue;
      updates.push({
        _id: item.id,
        ...(renamed ? { name: renamed } : {}),
        "system.known": true,
        "system.category": skill.category,
        "system.level": Math.max(item.system.level ?? 0, skill.level),
        "system.mastered": Boolean(item.system.mastered || skill.mastered),
        "system.masteryPsf": skill.mastered ? skill.masteryPsf : item.system.masteryPsf ?? CNS5.startingMastery.psf,
        "system.sunsign": Boolean(item.system.sunsign || skill.sunsign),
        "system.masteryFree": Boolean(item.system.masteryFree || skill.masteryFree),
        ...(created ? { "system.origin": skill.origin } : {})
      });
    }
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);

    // A mage's Mode is the skill his magick is reckoned from, and his
    // tradition which aspect bonus he takes (pp.134, 288).
    const traditions = { mage: "mage", priestMage: "priestMage", priest: "cleric" };
    const tradition = traditions[state.voc.group];
    if (tradition) {
      await this.actor.update({
        "system.magick.tradition": tradition,
        ...(state.voc.modeName ? { "system.magick.mode": state.voc.modeName } : {})
      });
    }

    // The attributes further masteries are reckoned by (p120). An
    // Adventurer's come from his specialities, which is the player's to say.
    if (state.voc.attributes.primary && state.voc.attributes.secondary) {
      await this.actor.update({
        "system.details.vocationAttributes.primary": state.voc.attributes.primary,
        "system.details.vocationAttributes.secondary": state.voc.attributes.secondary
      });
    }
  }

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
  /*  Step 5a: social class (pp.58-60)            */
  /* -------------------------------------------- */

  /**
   * What the class comes to in PC Points: gained for a poor start, spent for a
   * high one. A band belonging to another class, left over from a change of
   * class, counts for nothing.
   */
  static #classPoints(draft) {
    const table = CNS5.socialClasses[draft.period] ?? CNS5.socialClasses.hc;
    const cls = table.find((c) => c.key === draft.socialClassKey);
    if (!cls) return 0;
    if (!cls.bands) return cls.pcGained ?? 0;
    return cls.bands.find((b) => b.key === draft.socialBand)?.pcGained ?? 0;
  }

  /** Two rolls: the class, then where in it. */
  /**
   * The vocation tables and the skill list, loaded once. The skill list is
   * what a vocation's skills are matched against, so that "Knife Fighting" is
   * granted as Knife & Dagger Fighting.
   */
  static async #backgroundData() {
    if (CnS5CreationWizard.#background) return CnS5CreationWizard.#background;
    const [vocations, skills, nobility, outsiders, callings] = await Promise.all([
      foundry.utils.fetchJsonWithTimeout("systems/cns5/data/vocations.json"),
      foundry.utils.fetchJsonWithTimeout("systems/cns5/data/skills.json"),
      foundry.utils.fetchJsonWithTimeout("systems/cns5/data/nobility.json"),
      foundry.utils.fetchJsonWithTimeout("systems/cns5/data/outsiders.json"),
      foundry.utils.fetchJsonWithTimeout("systems/cns5/data/character-vocations.json")
    ]);
    const byName = new Map(skills.skills.map((sk) => [sk.name.toLowerCase(), sk.name]));
    CnS5CreationWizard.#background = {
      vocations,
      nobility,
      outsiders,
      callings,
      index: indexSkills(skills.skills),
      resolve: (name) => byName.get(String(name).trim().toLowerCase()) ?? null
    };
    return CnS5CreationWizard.#background;
  }

  static #background = null;

  /**
   * Roll the father's vocation for the class and band chosen above, following
   * the table where it sends the roller.
   */
  static async #onRollFathersVocation() {
    const { vocations, nobility, outsiders } = await CnS5CreationWizard.#backgroundData();
    const d100 = async () => (await new Roll("1d100").evaluate()).total;

    // Jews and slaves have tables of their own (pp.60-65).
    if (this.draft.socialClassKey === "outsider") {
      const found = await rollOutsiderBackground(
        outsiders,
        vocations,
        { kind: this.draft.outsiderKind, period: this.draft.period, mediterranean: this.draft.mediterranean },
        d100
      );
      if (!found) {
        ui.notifications.warn(game.i18n.localize("CNS5.Creation.noVocationTable"));
        return;
      }
      // A slave of the later periods outside the Mediterranean is a destitute
      // serf in all but name.
      if (found.treatAs) {
        const serf = await rollFathersVocation(vocations, found.treatAs.cls, found.treatAs.band, d100);
        this.#takeFather(serf, "CNS5.Creation.slaveAsSerf");
        return;
      }
      if (found.owner) {
        found.vocation = game.i18n.format("CNS5.Creation.slaveOf", {
          vocation: found.vocation,
          band: game.i18n.localize(`CNS5.SocialBand.${found.owner.band}`).toLowerCase(),
          household: game.i18n.localize(`CNS5.SlaveOwner.${found.owner.household}`)
        });
      }
      this.#takeFather(found, found.link === "leper" ? "CNS5.Creation.fatherLeper" : "");
      if (Number.isFinite(found.wider)) {
        this.draft.fatherStatus = game.i18n.format("CNS5.Creation.jewishStatus", {
          status: found.status,
          wider: found.wider
        });
      }
      this.render();
      return;
    }

    // The fighting classes follow their own tables: rank, the father's
    // vocation for the period, and his holdings (pp.77-81).
    if (this.draft.socialClassKey === "chivalric") {
      const dice = { d100, roll: async (formula) => (await new Roll(formula).evaluate()).total };
      const found = await rollChivalricBackground(
        nobility,
        { period: this.draft.period, band: this.draft.socialBand, scholarly: this.draft.scholarly },
        dice,
        CNS5
      );
      Object.assign(this.draft, {
        fathersVocation: CnS5CreationWizard.#chivalricLabel(found),
        fatherSkills: found.skills,
        fatherStatus: Number.isFinite(found.status) && !found.statusNote ? String(found.status) : "",
        fatherGrants: [],
        fatherLabourer: false,
        fatherReadingInt: this.draft.scholarly ? null : found.readingInt,
        fatherRolls: game.i18n.format("CNS5.Creation.fatherRolled", {
          rolls: found.rolls.join(", "),
          pages: found.pages.map((pg) => `p${pg}`).join(", ")
        }),
        fatherNote: found.statusNote === "household" ? "CNS5.Creation.fatherHousehold" : ""
      });
      this.render();
      return;
    }

    const found = await rollFathersVocation(
      vocations, this.draft.socialClassKey, this.draft.socialBand, d100
    );
    if (!found) {
      ui.notifications.warn(game.i18n.localize("CNS5.Creation.noVocationTable"));
      return;
    }

    Object.assign(this.draft, {
      fathersVocation: found.vocation,
      fatherSkills: found.skills,
      fatherStatus: Number.isFinite(found.status) ? String(found.status) : found.statusNote ?? "",
      fatherGrants: found.grants,
      fatherLabourer: found.labourer,
      fatherRolls: game.i18n.format("CNS5.Creation.fatherRolled", {
        rolls: found.rolls.join(", "),
        pages: found.pages.map((pg) => `p${pg}`).join(", ")
      }),
      // A father fallen from better days, or a leper, was once something else;
      // the book has the roller find out what, which is left to him.
      fatherNote: found.link === "originalClass"
        ? "CNS5.Creation.fatherOriginalClass"
        : found.link === "leper"
          ? "CNS5.Creation.fatherLeper"
          : ""
    });
    this.render();
  }

  /**
   * Take a rolled father into the draft.
   * @param {object} found  what one of the background rolls returned
   * @param {string} note   a message to show beneath it, if any
   */
  #takeFather(found, note) {
    Object.assign(this.draft, {
      fathersVocation: found.vocation,
      fatherSkills: found.skills,
      fatherStatus: Number.isFinite(found.status) ? String(found.status) : found.statusNote ?? "",
      fatherGrants: found.grants ?? [],
      fatherLabourer: Boolean(found.labourer),
      fatherReadingInt: null,
      backgroundPicks: {},
      fatherRolls: game.i18n.format("CNS5.Creation.fatherRolled", {
        rolls: found.rolls.join(", "),
        pages: found.pages.map((pg) => `p${pg}`).join(", ")
      }),
      fatherNote: note
    });
    this.render();
  }

  /**
   * "Knight, of the lesser gentry: a fief (SFMH2)", for the sheet.
   * @param {object} found  what rollChivalricBackground returned
   */
  static #chivalricLabel(found) {
    const rank = game.i18n.localize(`CNS5.ChivalricRank.${found.rank}`);
    const holdings = found.holdings.map((h) => {
      if (h.fief) {
        return game.i18n.format(`CNS5.Holding.${h.kind}`, { fief: h.fief.fief, share: h.share ?? "" });
      }
      return game.i18n.format(`CNS5.Holding.${h.kind}`, { acres: h.acres ?? "" });
    });
    return holdings.length
      ? `${found.vocation}, ${rank}: ${holdings.join("; ")}`
      : `${found.vocation}, ${rank}`;
  }

  /** "Wealthy Freeman", as the sheet shows it. */
  static #classLabel(draft) {
    const cls = game.i18n.localize(`CNS5.SocialClass.${draft.socialClassKey}`);
    return draft.socialBand
      ? `${game.i18n.localize(`CNS5.SocialBand.${draft.socialBand}`)} ${cls}`
      : cls;
  }

  static async #onRollSocialClass() {
    const classRoll = (await new Roll("1d100").evaluate()).total;
    const bandRoll = (await new Roll("1d100").evaluate()).total;
    const found = CNS5.socialClassFor(this.draft.period, classRoll, bandRoll);
    this.draft.socialClassKey = found.cls.key;
    this.draft.socialBand = found.band?.key ?? "";
    this.draft.socialRolls = game.i18n.format("CNS5.Creation.socialRolled", {
      classRoll,
      bandRoll: found.band ? bandRoll : "—"
    });
    this.render();
  }

  static async #onDefaultSocialClass() {
    this.draft.socialClassKey = CNS5.defaultSocialClass.key;
    this.draft.socialBand = CNS5.defaultSocialClass.band;
    this.draft.socialRolls = "";
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
      "system.details.socialClass": CnS5CreationWizard.#classLabel(draft),
      "system.details.socialClassKey": draft.socialClassKey,
      "system.details.socialBand": draft.socialBand,
      "system.details.fathersVocation": draft.fathersVocation,
      "system.details.socialStatus": draft.fatherStatus ?? "",
      "system.details.familyStatus": draft.familyStatus,
      "system.details.starSign": draft.sign ? game.i18n.localize(CNS5.birthSigns[draft.sign].label) : "",
      "system.details.legitimacy": draft.legitimacy,
      "system.details.siblingRank": Number(draft.siblingRank) || CNS5.defaultSiblingRank,
      "system.details.vocation": this.#vocationLabel(),
      "system.details.vocationKey": draft.vocationKey ?? "",
      "system.details.vocationVariant": draft.vocationVariant ?? "",
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

    // "Selecting Peasant status enables a character to... An additional +2
    // Strength... Both Conditioning and Endurance at Level 1 are also gained as
    // background skills" (p58). The two skills of his choice raised a level
    // are left to him, and the racial maximum on Strength to the Gamemaster.
    const classBonuses = {};
    if (CNS5.peasantClasses.includes(draft.socialClassKey)) {
      classBonuses.str = CNS5.peasantBenefits.strength;
      await this.actor.update({
        "system.attributes.str.value":
          this.actor.system.attributes.str.value + CNS5.peasantBenefits.strength
      });
      for (const skill of CNS5.peasantBenefits.skills) {
        await this.actor.grantSkill(skill.name, { level: skill.level });
      }
    }

    // "The character begins with Level 0 in those skills listed for his
    // father's vocation" (p119) — at a higher level where the table says so.
    // Choices among skills are the player's, and are left in his notes.
    if (draft.fatherSkills) {
      const { resolve } = await CnS5CreationWizard.#backgroundData();
      const parsed = parseBackgroundSkills(draft.fatherSkills, resolve);
      // Choices the player has made in the vocation step are granted; those
      // he has not are left in his notes.
      const chosen = (i) => Object.values(draft.backgroundPicks?.[i] ?? {}).filter(Boolean);
      const grant = [
        ...parsed.named,
        ...(draft.fatherGrants ?? []).map((name) => ({ name: resolve(name) ?? name, level: 0 })),
        ...(draft.fatherLabourer ? CNS5.labourerSkills : []),
        ...parsed.choices.flatMap((c, i) => chosen(i).map((name) => ({ name, level: 0 })))
      ];
      for (const skill of grant) await this.actor.grantSkill(skill.name, { level: skill.level });

      const owed = [
        ...parsed.choices.filter((c, i) => chosen(i).length < (c.count || 1)).map((c) => c.label),
        ...parsed.missing.map((m) => game.i18n.format("CNS5.Creation.notInSkillList", { name: m }))
      ];
      // Marked, so running the wizard again replaces the note, not adds to it.
      const earlier = (this.actor.system.details.familyNotes ?? "")
        .replace(/<p data-cns5="background-choices">[\s\S]*?<\/p>/g, "");
      const note = owed.length
        ? `<p data-cns5="background-choices"><strong>${game.i18n.localize(
            "CNS5.Creation.backgroundChoices"
          )}</strong> ${owed.join("; ")}</p>`
        : "";
      await this.actor.update({ "system.details.familyNotes": `${earlier}${note}` });
    }

    // A chivalric son reads his own language if his Intellect allows (p78); a
    // scholar may read more languages the higher it is (p77). Intellect is
    // not known until step 11, which is why this waits for the finish.
    if (draft.socialClassKey === "chivalric") {
      const int = draft.attributes.int ?? 0;
      if (draft.fatherReadingInt && int >= draft.fatherReadingInt) {
        await this.actor.grantSkill(CNS5.readingSkill);
      }
      if (draft.scholarly) {
        const owed = [];
        for (const lang of CNS5.scholarlyLanguages) {
          if (int < lang.int) continue;
          if (lang.skill) await this.actor.grantSkill(lang.skill);
          else owed.push(game.i18n.localize(lang.label));
        }
        // Marked, so running the wizard again replaces the note, not adds to it.
        const notes = (this.actor.system.details.familyNotes ?? "")
          .replace(/<p data-cns5="scholar-languages">[\s\S]*?<\/p>/g, "");
        const note = owed.length
          ? `<p data-cns5="scholar-languages"><strong>${game.i18n.localize(
              "CNS5.Creation.scholarLanguages"
            )}</strong> ${owed.join("; ")}</p>`
          : "";
        await this.actor.update({ "system.details.familyNotes": `${notes}${note}` });
      }
    }
    // The vocation and its starting skills (pp.119-146), once every
    // background skill is in place.
    await this.#applyVocation();

    // "All 'gentle' PC's gain +10% to PSF% to the skills of Courtly Love (not
    // EF) and Leadership" (p77) — which the skills already apply to a
    // character marked gentle.
    // Set for the chivalric, never cleared: a Gamemaster may have marked
    // someone gentle for reasons of his own.
    if (draft.socialClassKey === "chivalric") await this.actor.update({ "system.details.gentle": true });

    // Townsmen gain +3 Agility (p70); the racial maximum is the Gamemaster's.
    if (draft.socialClassKey === "townsman") {
      classBonuses.agl = CNS5.townsmanBenefits.agility;
      await this.actor.update({
        "system.derived.agl.mod": (this.actor.system.derived.agl.mod ?? 0) + CNS5.townsmanBenefits.agility
      });
    }
    await this.actor.setFlag("cns5", "classBonuses", classBonuses);

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

    // A mage goes on to buy his starting spells (p295), now that his Methods
    // and Magick Level are on the sheet to reckon them from.
    if (this.actor.system.magick?.mode && (this.actor.system.magick?.level ?? 0) > 0) {
      new CnS5StartingSpells(this.actor).render({ force: true });
    }
  }
}
