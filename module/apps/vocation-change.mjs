import { CNS5 } from "../config.mjs";
import {
  resolveVocation,
  indexSkills,
  vocationalOptions,
  planVocationChange,
  checkVocationChange
} from "../helpers/vocations.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Changing vocation (p130).
 *
 * "The procedure would involve the character spending three months in
 * downtime assuming the mantle of the new vocation. After this period, they
 * will acquire 3 vocational skills at level 1 selected from their new
 * vocation." Skills of the new vocation are promoted to Primary, skills of the
 * old one alone demoted to Secondary, and "Mastery Bonuses for old skills are
 * not lost."
 *
 * The downtime is the Gamemaster's to allow; this applies what follows it.
 * The change is shown in full before it is made.
 */
export class CnS5VocationChange extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "cns5-vocation-change-{id}",
    classes: ["cns5", "cns5-wizard", "cns5-vocation-change"],
    position: { width: 560, height: 640 },
    window: { title: "CNS5.Vocation.changeTitle", resizable: true, contentClasses: ["standard-form"] },
    actions: {
      apply: CnS5VocationChange.#onApply
    }
  };

  /** @override */
  static PARTS = {
    body: { template: "systems/cns5/templates/apps/vocation-change.hbs", scrollable: [""] }
  };

  /**
   * @param {Actor} actor
   * @param {object} [options]
   */
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.state = { key: "", variant: "", picks: ["", "", ""] };
  }

  /** @override */
  get title() {
    return `${game.i18n.localize("CNS5.Vocation.changeTitle")}: ${this.actor.name}`;
  }

  /** The vocation tables and the skills list, loaded once. */
  static async data() {
    if (CnS5VocationChange.#data) return CnS5VocationChange.#data;
    const [callings, skills] = await Promise.all([
      foundry.utils.fetchJsonWithTimeout("systems/cns5/data/character-vocations.json"),
      foundry.utils.fetchJsonWithTimeout("systems/cns5/data/skills.json")
    ]);
    CnS5VocationChange.#data = { callings, index: indexSkills(skills.skills) };
    return CnS5VocationChange.#data;
  }

  static #data = null;

  /** The character's skills, as the vocation helpers read them. */
  #held() {
    return this.actor.items
      .filter((i) => i.type === "skill")
      .map((i) => ({
        // A core skill is created under the worksheet's name; the vocation
        // tables use the skills list's.
        // An Elementalist's Mode is named for his element on the sheet.
        name: CNS5.coreSkills.find((c) => c.name === i.name)?.listName ??
          (/ Elementalist Mode of Magick$/.test(i.name) ? "Elementalist Magus Mode of Magick" : i.name),
        item: i,
        category: i.system.category,
        level: i.system.level ?? 0
      }));
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const data = await CnS5VocationChange.data();
    const ctx = { index: data.index, filters: data.callings.filters };
    const state = this.state;
    const current = this.actor.system.details.vocationKey;

    const order = ["warrior", "thief", "other", "mage", "priestMage", "priest", "adventurer"];
    context.vocationGroups = order.map((group) => ({
      label: `CNS5.Vocation.group.${group}`,
      options: data.callings.vocations
        .filter((v) => v.group === group && !(v.key === current && !v.variants))
        .map((v) => ({ value: v.key, label: v.name, selected: v.key === state.key }))
    }));
    context.state = state;
    context.from = this.actor.system.details.vocation;

    const voc = resolveVocation(data.callings, state.key, state.variant);
    context.voc = voc;
    if (!voc) return context;

    context.variants = voc.variants.map((v) => ({ value: v.key, label: v.name, selected: v.key === voc.variant }));
    const held = this.#held();
    const primaryOptions = vocationalOptions(voc, { ...ctx, background: new Set() })
      .filter((o) => o.category === "primary")
      .map((o) => o.name);
    context.pickSlots = state.picks.map((value, i) => ({
      index: i,
      value,
      options: primaryOptions.map((name) => ({ name, selected: name === value }))
    }));

    const label = (c) => (c ? `CNS5.SkillCategory.${c}` : "CNS5.Vocation.new");
    context.plan = planVocationChange(voc, held, state.picks, ctx).map((p) => ({
      ...p,
      fromLabel: label(p.from),
      toLabel: label(p.to)
    }));
    context.problems = checkVocationChange(voc, held, state.picks, ctx).map((p) =>
      game.i18n.format(`CNS5.Vocation.problem.${p.key}`, p.data)
    );
    context.rule = game.i18n.format("CNS5.Vocation.changeHint", {
      months: CNS5.vocationChange.months,
      skills: CNS5.vocationChange.skills
    });
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const field of this.element.querySelectorAll("[data-field]")) {
      field.addEventListener("change", (event) => {
        const { field: path } = event.currentTarget.dataset;
        const value = event.currentTarget.value;
        if (path === "key") Object.assign(this.state, { key: value, variant: "", picks: ["", "", ""] });
        else if (path === "variant") this.state.variant = value;
        else this.state.picks[Number(path)] = value;
        this.render();
      });
    }
  }

  /**
   * Make the change.
   * @this {CnS5VocationChange}
   */
  static async #onApply() {
    const data = await CnS5VocationChange.data();
    const ctx = { index: data.index, filters: data.callings.filters };
    const voc = resolveVocation(data.callings, this.state.key, this.state.variant);
    if (!voc) return;
    const held = this.#held();
    const picks = this.state.picks.filter(Boolean);

    const problems = checkVocationChange(voc, held, picks, ctx);
    if (problems.length) {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("CNS5.Vocation.changeTitle") },
        content: `<p>${game.i18n.localize("CNS5.Vocation.changeAnyway")}</p><ul>${problems
          .map((p) => `<li>${game.i18n.format(`CNS5.Vocation.problem.${p.key}`, p.data)}</li>`)
          .join("")}</ul>`
      });
      if (!proceed) return;
    }

    const byName = new Map(held.map((h) => [h.name, h.item]));
    const updates = [];
    for (const step of planVocationChange(voc, held, picks, ctx)) {
      const item = byName.get(step.name) ?? (await this.actor.grantSkill(step.name, { level: step.level }));
      if (!item) continue;
      updates.push({ _id: item.id, "system.category": step.to, "system.level": step.level, "system.known": true });
    }
    if (updates.length) await this.actor.updateEmbeddedDocuments("Item", updates);

    const name = voc.variantName ? `${voc.name} (${voc.variantName})` : voc.name;
    await this.actor.update({
      "system.details.vocation": name,
      "system.details.vocationKey": voc.key,
      "system.details.vocationVariant": voc.variant,
      "system.details.vocationAttributes.primary": voc.attributes.primary ?? "",
      "system.details.vocationAttributes.secondary": voc.attributes.secondary ?? ""
    });
    ui.notifications.info(game.i18n.format("CNS5.Vocation.changed", { name: this.actor.name, vocation: name }));
    await this.close();
  }
}
