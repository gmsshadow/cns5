import { CNS5 } from "../config.mjs";
import { CnS5CreationWizard } from "../apps/creation-wizard.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * The character sheet.
 *
 * The six tabs match the six pages of the printed sheet one for one, so a player
 * who knows the paper sheet already knows where to look. Core & Combat and
 * Skills & Experience are built; the rest render a stub naming what will live
 * there.
 */
export class CnS5CharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /* -------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["cns5", "sheet", "actor", "character"],
    position: { width: 900, height: 800 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollAttribute: CnS5CharacterSheet.#onRollAttribute,
      rollSkill: CnS5CharacterSheet.#onRollSkill,
      createSkill: CnS5CharacterSheet.#onCreateSkill,
      addCoreSkills: CnS5CharacterSheet.#onAddCoreSkills,
      editSkill: CnS5CharacterSheet.#onEditItem,
      deleteSkill: CnS5CharacterSheet.#onDeleteItem,
      rollWeapon: CnS5CharacterSheet.#onRollWeapon,
      rollSpell: CnS5CharacterSheet.#onRollSpell,
      rollActOfFaith: CnS5CharacterSheet.#onRollActOfFaith,
      createItem: CnS5CharacterSheet.#onCreateItem,
      editItem: CnS5CharacterSheet.#onEditItem,
      deleteItem: CnS5CharacterSheet.#onDeleteItem,
      toggleEquipped: CnS5CharacterSheet.#onToggleEquipped,
      toggleCarried: CnS5CharacterSheet.#onToggleCarried,
      openWizard: CnS5CharacterSheet.#onOpenWizard
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    header: { template: "systems/cns5/templates/actor/parts/header.hbs" },
    tabs: { template: "templates/generic/tab-navigation.hbs" },
    core: {
      template: "systems/cns5/templates/actor/parts/core-combat.hbs",
      scrollable: [""]
    },
    background: {
      template: "systems/cns5/templates/actor/parts/background.hbs",
      scrollable: [""]
    },
    skills: {
      template: "systems/cns5/templates/actor/parts/skills.hbs",
      scrollable: [""]
    },
    chattel: {
      template: "systems/cns5/templates/actor/parts/chattel.hbs",
      scrollable: [""]
    },
    magick: {
      template: "systems/cns5/templates/actor/parts/magick.hbs",
      scrollable: [""]
    },
    faith: {
      template: "systems/cns5/templates/actor/parts/faith.hbs",
      scrollable: [""]
    }
  };

  /* -------------------------------------------- */

  /** Tab definitions, in printed-sheet page order. */
  static TAB_DEFINITIONS = [
    { id: "core", icon: "fa-solid fa-shield-halved" },
    { id: "background", icon: "fa-solid fa-scroll" },
    { id: "skills", icon: "fa-solid fa-list-check" },
    { id: "chattel", icon: "fa-solid fa-sack-dollar" },
    { id: "magick", icon: "fa-solid fa-hat-wizard" },
    { id: "faith", icon: "fa-solid fa-cross" }
  ];

  /* -------------------------------------------- */

  /** @type {string} */
  #activeTab = "core";

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    context.system = system;
    context.fields = this.actor.system.schema.fields;
    context.editable = this.isEditable;
    context.config = CNS5;

    context.groups = Object.entries(CNS5.attributeGroups).map(([group, keys]) => ({
      id: group,
      label: `CNS5.AttributeGroup.${group}`,
      attributes: keys.map((key) => ({
        ...system.attr[key],
        label: `CNS5.Attribute.${key}.long`,
        abbr: `CNS5.Attribute.${key}.abbr`,
        // Derived attributes take their innate aptitude modifier as the editable
        // field; primaries take the attribute value itself.
        path: system.attr[key].derived
          ? `system.derived.${key}.mod`
          : `system.attributes.${key}.value`,
        editValue: system.attr[key].derived ? system.derived[key].mod : system.attr[key].value
      }))
    }));

    context.skillGroups = this.#getSkillGroups();
    context.chattelGroups = this.#getChattelGroups();

    const byName = (a, b) => a.name.localeCompare(b.name);
    context.weapons = this.actor.items.filter((i) => i.type === "weapon").sort(byName);
    context.armour = this.actor.items.filter((i) => i.type === "armour").sort(byName);
    context.spells = this.actor.items.filter((i) => i.type === "spell").sort(byName);
    context.acts = this.actor.items.filter((i) => i.type === "actOfFaith").sort(byName);

    // Primary religion first, then the rest alphabetically.
    context.religions = this.actor.items
      .filter((i) => i.type === "religion")
      .sort((a, b) => Number(b.system.primary) - Number(a.system.primary) || byName(a, b));

    context.rangeKeys = Object.keys(CNS5.spellRanges);
    context.spentMR = context.spells.reduce((total, s) => total + s.system.mr, 0);

    context.currency = Object.entries(CNS5.currency).map(([key, coin]) => ({
      key,
      label: coin.label,
      abbr: coin.abbr,
      value: system.currency[key]
    }));

    context.characterTypes = this.#choices(CNS5.characterTypes, system.details.characterType);
    context.periods = this.#choices(CNS5.periods, system.details.period);
    context.birthOmens = this.#choices(CNS5.birthOmens, system.details.birthOmens);
    context.traditions = this.#choices(CNS5.magickTraditions, system.magick.tradition);

    const enrich = foundry.applications.ux.TextEditor.implementation.enrichHTML;
    const enrichOptions = { relativeTo: this.actor, secrets: this.actor.isOwner };
    context.biographyHTML = await enrich(system.biography, enrichOptions);
    context.familyNotesHTML = await enrich(system.details.familyNotes, enrichOptions);

    context.tabs = this.#getTabs();
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Turn a config map into select options, marking the current value.
   * @param {object} source
   * @param {string} selected
   * @returns {Array<object>}
   */
  #choices(source, selected) {
    return Object.entries(source).map(([value, entry]) => ({
      value,
      label: typeof entry === "string" ? entry : entry.label,
      selected: value === selected
    }));
  }

  /* -------------------------------------------- */

  /**
   * Group everything carried for the Personal Chattel tab.
   *
   * Weapons and armour appear here as well as on the combat tab. They are the
   * same items either way, and leaving them out would make the encumbrance
   * total look wrong: a suit of maille is most of what a knight is carrying.
   *
   * @returns {Array<object>}
   */
  #getChattelGroups() {
    const byName = (a, b) => a.name.localeCompare(b.name);
    const groups = [
      { id: "equipment", label: "CNS5.Item.equipment", types: ["equipment"] },
      { id: "arms", label: "CNS5.Item.arms", types: ["weapon", "armour"] }
    ];

    return groups
      .map((group) => ({
        ...group,
        items: this.actor.items.filter((i) => group.types.includes(i.type)).sort(byName)
      }))
      .filter((group) => group.items.length);
  }

  /* -------------------------------------------- */

  /**
   * Group skills by category in the printed sheet's order, dropping any
   * category the character has nothing in.
   *
   * Competencies are pulled into their own band regardless of category, since
   * the printed sheet lists them separately above the skill table.
   *
   * @returns {Array<object>}
   */
  #getSkillGroups() {
    const skills = this.actor.items
      .filter((item) => item.type === "skill")
      .sort((a, b) => a.name.localeCompare(b.name));

    const groups = [];

    const competencies = skills.filter((s) => s.system.kind === "competency");
    if (competencies.length) {
      groups.push({ id: "competency", label: "CNS5.Skill.competencies", skills: competencies });
    }

    for (const category of CNS5.skillCategoryOrder) {
      const inCategory = skills.filter(
        (s) => s.system.kind !== "competency" && s.system.category === category
      );
      if (inCategory.length) {
        groups.push({
          id: category,
          label: CNS5.skillCategories[category].label,
          skills: inCategory
        });
      }
    }

    return groups;
  }

  /* -------------------------------------------- */

  /** @override */
  async _preparePartContext(partId, context) {
    if (partId in context.tabs) context.tab = context.tabs[partId];
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Build the tab record consumed by the generic navigation template.
   * @returns {Record<string, object>}
   */
  #getTabs() {
    return CnS5CharacterSheet.TAB_DEFINITIONS.reduce((tabs, def) => {
      tabs[def.id] = {
        id: def.id,
        group: "primary",
        icon: def.icon,
        label: `CNS5.Tabs.${def.id}`,
        active: this.#activeTab === def.id,
        cssClass: this.#activeTab === def.id ? "active" : ""
      };
      return tabs;
    }, {});
  }

  /* -------------------------------------------- */

  /** @override */
  changeTab(tab, group, options) {
    super.changeTab(tab, group, options);
    if (group === "primary") this.#activeTab = tab;
  }

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (!this.isEditable) return;

    // Skill levels are edited inline in the table, so the name attribute cannot
    // address the embedded item through the sheet's own form. Route each change
    // to its item explicitly.
    for (const input of this.element.querySelectorAll("[data-cns5-level]")) {
      input.addEventListener("change", this.#onEditLevel.bind(this));
    }

    // Accept skills dragged in from the compendium.
    new foundry.applications.ux.DragDrop.implementation({
      dropSelector: ".window-content",
      callbacks: { drop: this.#onDrop.bind(this) }
    }).bind(this.element);
  }

  /* -------------------------------------------- */

  /**
   * Handle a document dropped onto the sheet.
   *
   * Only skills are accepted for now. Dropping one the character already has
   * would silently create a second copy with its own level, which is never what
   * anyone means, so a duplicate name is refused rather than merged.
   *
   * @param {DragEvent} event
   */
  async #onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type !== "Item") return;

    const item = await fromUuid(data.uuid);
    if (!item) return;

    // Skills are refused as duplicates by name because two copies of one skill
    // would mean two levels for the same ability. Everything else can be owned
    // more than once — three daggers is a normal thing to carry.
    const stackable = ["weapon", "armour", "equipment", "spell", "actOfFaith", "religion"];
    if (stackable.includes(item.type)) {
      await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
      ui.notifications.info(game.i18n.format("CNS5.Skill.added", { name: item.name }));
      return;
    }

    if (item.type !== "skill") return;

    // A drop from within this same actor is a reorder, not a new skill.
    if (item.parent?.id === this.actor.id) return;

    const duplicate = this.actor.items.find(
      (i) => i.type === "skill" && i.name.toLowerCase() === item.name.toLowerCase()
    );
    if (duplicate) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Skill.duplicate", { name: item.name })
      );
      return;
    }

    await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
    ui.notifications.info(game.i18n.format("CNS5.Skill.added", { name: item.name }));
  }

  /* -------------------------------------------- */

  /**
   * @param {Event} event
   */
  async #onEditLevel(event) {
    const input = event.currentTarget;
    const item = this.actor.items.get(input.dataset.itemId);
    if (!item) return;
    await item.update({ "system.level": Math.max(0, Number(input.value) || 0) });
  }

  /* -------------------------------------------- */

  /**
   * Roll an Attribute Roll. Shift-click skips the modifier dialog.
   * @this {CnS5CharacterSheet}
   */
  static async #onRollAttribute(event, target) {
    const attribute = target.dataset.attribute;
    if (!attribute) return;
    await this.actor.rollAttribute(attribute, { skipDialog: event.shiftKey });
  }

  /* -------------------------------------------- */

  /**
   * Roll a skill check. Shift-click skips the modifier dialog.
   * @this {CnS5CharacterSheet}
   */
  static async #onRollSkill(event, target) {
    const itemId = target.dataset.itemId;
    if (!itemId) return;
    await this.actor.rollSkill(itemId, { skipDialog: event.shiftKey });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onCreateSkill(event, target) {
    const [item] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: game.i18n.localize("CNS5.Skill.newSkill"),
        type: "skill",
        system: { kind: target.dataset.kind ?? "skill" }
      }
    ]);
    item?.sheet.render({ force: true });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onAddCoreSkills() {
    await this.actor.addCoreSkills();
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onEditItem(event, target) {
    this.actor.items.get(target.dataset.itemId)?.sheet.render({ force: true });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onDeleteItem(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("CNS5.Item.delete") },
      content: `<p>${game.i18n.format("CNS5.Skill.deleteConfirm", { name: item.name })}</p>`
    });

    if (confirmed) await item.delete();
  }

  /* -------------------------------------------- */

  /**
   * Create a blank item of the type named on the button and open it.
   * @this {CnS5CharacterSheet}
   */
  static async #onCreateItem(event, target) {
    const type = target.dataset.type;
    if (!type) return;

    const [item] = await this.actor.createEmbeddedDocuments("Item", [
      { name: game.i18n.localize(`CNS5.Item.new.${type}`), type }
    ]);
    item?.sheet.render({ force: true });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onToggleEquipped(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item) await item.update({ "system.equipped": !item.system.equipped });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onToggleCarried(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item) await item.update({ "system.carried": !item.system.carried });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static #onOpenWizard() {
    new CnS5CreationWizard(this.actor).render({ force: true });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onRollWeapon(event, target) {
    await this.actor.rollWeapon(target.dataset.itemId, { skipDialog: event.shiftKey });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onRollSpell(event, target) {
    await this.actor.rollSpell(target.dataset.itemId, target.dataset.range ?? "short", {
      skipDialog: event.shiftKey
    });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onRollActOfFaith(event, target) {
    await this.actor.rollActOfFaith(target.dataset.itemId, { skipDialog: event.shiftKey });
  }
}
