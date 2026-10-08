import { CNS5 } from "../config.mjs";
import { spellCost, checkStartingSpells } from "../helpers/starting-spells.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Buying a new mage's starting spells (p295).
 *
 * The Spell Points are the sheet's: Method levels times Magick Level, and the
 * Heroic or Mythic bonus from the Mode's Attribute Bonus. Each spell costs
 * the MR this mage learns it at, and arrives fully learnt. The two Common
 * Spells every mage has (p292) come free, and a simple focus may be bought for
 * ten points.
 */
export class CnS5StartingSpells extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "cns5-starting-spells-{id}",
    classes: ["cns5", "cns5-wizard", "cns5-starting-spells"],
    position: { width: 620, height: 720 },
    window: { title: "CNS5.StartingSpells.title", resizable: true, contentClasses: ["standard-form"] },
    actions: {
      toggleSpell: CnS5StartingSpells.#onToggle,
      apply: CnS5StartingSpells.#onApply
    }
  };

  /** @override */
  static PARTS = {
    body: { template: "systems/cns5/templates/apps/starting-spells.hbs", scrollable: [".cns5-starting-spells__list"] }
  };

  /**
   * @param {Actor} actor
   * @param {object} [options]
   */
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.picks = new Set();
    this.focus = false;
    this.onlyCastable = true;
  }

  /** @override */
  get title() {
    return `${game.i18n.localize("CNS5.StartingSpells.title")}: ${this.actor.name}`;
  }

  /** The spell compendium's index, with what pricing a spell needs. */
  static async index() {
    const pack = game.packs.get("cns5.spells");
    if (!pack) return [];
    const index = await pack.getIndex({
      fields: ["system.mr", "system.mrNote", "system.mode", "system.group", "system.fpToCast"]
    });
    return [...index].map((e) => ({
      _id: e._id,
      uuid: e.uuid ?? `Compendium.cns5.spells.Item.${e._id}`,
      name: e.name,
      mr: e.system?.mr ?? 0,
      mrNote: e.system?.mrNote ?? "",
      mode: e.system?.mode ?? "",
      group: e.system?.group ?? "",
      fp: e.system?.fpToCast ?? 0
    }));
  }

  /** The mage as the pricing reads him. */
  #mage() {
    const system = this.actor.system;
    return {
      mode: system.magick?.mode ?? "",
      ml: system.magick?.level ?? 0,
      methods: CNS5.knownMethods([...this.actor.items]).map((s) => s.name)
    };
  }

  /** Spell Points already spent: on spells he has, and a starting focus. */
  #heldPoints(mage) {
    const common = new Set(CNS5.commonSpells.map((n) => n.toLowerCase()));
    const spells = this.actor.items.filter((i) => i.type === "spell" && !common.has(i.name.toLowerCase()));
    const focus = this.actor.items.some((i) => i.getFlag?.("cns5", "startingFocus"));
    return {
      spells: spells.map((i) => i.name),
      points:
        spells.reduce((total, i) => total + spellCost({ ...i.system, mr: i.system.mr, name: i.name }, mage).cost, 0) +
        (focus ? CNS5.simpleFocusSpellPoints : 0),
      focus
    };
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;
    const mage = this.#mage();
    const held = this.#heldPoints(mage);
    const points = system.magick?.startingPoints ?? { base: 0, bonus: 0, total: 0 };
    const common = new Set(CNS5.commonSpells.map((n) => n.toLowerCase()));
    const owned = new Set(held.spells.map((n) => n.toLowerCase()));

    const all = (await CnS5StartingSpells.index())
      .filter((s) => !common.has(s.name.toLowerCase()) && !owned.has(s.name.toLowerCase()))
      .map((s) => ({ ...s, ...spellCost(s, mage), picked: this.picks.has(s._id) }));

    const shown = all.filter((s) => s.picked || !this.onlyCastable || (s.castable && s.learnable));
    const groups = new Map();
    for (const s of shown.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))) {
      if (!groups.has(s.group)) groups.set(s.group, []);
      groups.get(s.group).push(s);
    }

    const picks = all.filter((s) => s.picked);
    const check = checkStartingSpells({ picks, focus: this.focus, points: points.total, held: held.points, ml: mage.ml });

    Object.assign(context, {
      mage,
      points,
      held,
      spent: check.spent,
      left: check.left,
      picks,
      focus: this.focus,
      focusOwned: held.focus,
      focusCost: CNS5.simpleFocusSpellPoints,
      onlyCastable: this.onlyCastable,
      maxMr: CNS5.maxLearnableMr(mage.ml),
      characterType: `CNS5.CharacterType.${system.details.characterType}`,
      groups: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, spells]) => ({ group, spells })),
      problems: check.problems.map((p) => game.i18n.format(`CNS5.StartingSpells.problem.${p.key}`, p.data)),
      noMage: !mage.mode || mage.ml < 1,
      common: CNS5.commonSpells.join(", ")
    });
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("[data-field=focus]")?.addEventListener("change", (event) => {
      this.focus = event.currentTarget.checked;
      this.render();
    });
    this.element.querySelector("[data-field=onlyCastable]")?.addEventListener("change", (event) => {
      this.onlyCastable = event.currentTarget.checked;
      this.render();
    });
  }

  /** @this {CnS5StartingSpells} */
  static #onToggle(event, target) {
    const id = target.dataset.id;
    if (!id) return;
    if (this.picks.has(id)) this.picks.delete(id);
    else this.picks.add(id);
    this.render();
  }

  /**
   * Add the spells, fully learnt, with the Common Spells and any focus.
   * @this {CnS5StartingSpells}
   */
  static async #onApply() {
    const pack = game.packs.get("cns5.spells");
    if (!pack) {
      ui.notifications.warn(game.i18n.localize("CNS5.StartingSpells.noCompendium"));
      return;
    }
    const mage = this.#mage();
    const held = this.#heldPoints(mage);
    const index = await CnS5StartingSpells.index();
    const picks = index.filter((s) => this.picks.has(s._id)).map((s) => ({ ...s, ...spellCost(s, mage) }));
    const check = checkStartingSpells({
      picks,
      focus: this.focus,
      points: this.actor.system.magick?.startingPoints?.total ?? 0,
      held: held.points,
      ml: mage.ml
    });
    if (check.problems.length) {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize("CNS5.StartingSpells.title") },
        content: `<p>${game.i18n.localize("CNS5.StartingSpells.anyway")}</p><ul>${check.problems
          .map((p) => `<li>${game.i18n.format(`CNS5.StartingSpells.problem.${p.key}`, p.data)}</li>`)
          .join("")}</ul>`
      });
      if (!proceed) return;
    }

    // The Common Spells, which every mage has (p292), unless he has them.
    const have = new Set(this.actor.items.filter((i) => i.type === "spell").map((i) => i.name.toLowerCase()));
    const wanted = [
      ...picks.map((s) => s._id),
      ...index.filter((s) => CNS5.commonSpells.includes(s.name) && !have.has(s.name.toLowerCase())).map((s) => s._id)
    ];
    const sources = [];
    for (const id of wanted) {
      const doc = await pack.getDocument(id);
      if (!doc) continue;
      const source = doc.toObject();
      // Starting spells are learnt: nothing of their MR left to bring down.
      source.system.mrRemaining = 0;
      source.system.learnt = true;
      sources.push(source);
    }
    if (this.focus && !held.focus) {
      sources.push({
        name: game.i18n.localize("CNS5.StartingSpells.focusName"),
        type: "magickalItem",
        system: { kind: "focus", grade: "simple", makerMl: Math.max(1, mage.ml) },
        flags: { cns5: { startingFocus: true } }
      });
    }
    if (sources.length) await this.actor.createEmbeddedDocuments("Item", sources);
    ui.notifications.info(game.i18n.format("CNS5.StartingSpells.done", { count: picks.length, name: this.actor.name }));
    await this.close();
  }
}
