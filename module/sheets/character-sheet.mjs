import { CNS5 } from "../config.mjs";

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
      editSkill: CnS5CharacterSheet.#onEditSkill,
      deleteSkill: CnS5CharacterSheet.#onDeleteSkill
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
    background: { template: "systems/cns5/templates/actor/parts/stub.hbs" },
    skills: {
      template: "systems/cns5/templates/actor/parts/skills.hbs",
      scrollable: [""]
    },
    chattel: { template: "systems/cns5/templates/actor/parts/stub.hbs" },
    magick: { template: "systems/cns5/templates/actor/parts/stub.hbs" },
    faith: { template: "systems/cns5/templates/actor/parts/stub.hbs" }
  };

  /* -------------------------------------------- */

  /** Tab definitions, in printed-sheet page order. */
  static TAB_DEFINITIONS = [
    { id: "core", icon: "fa-solid fa-shield-halved", planned: null },
    { id: "background", icon: "fa-solid fa-scroll", planned: "background" },
    { id: "skills", icon: "fa-solid fa-list-check", planned: null },
    { id: "chattel", icon: "fa-solid fa-sack-dollar", planned: "chattel" },
    { id: "magick", icon: "fa-solid fa-hat-wizard", planned: "magick" },
    { id: "faith", icon: "fa-solid fa-cross", planned: "faith" }
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
    context.tabs = this.#getTabs();
    return context;
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
    if (partId in context.tabs) {
      context.tab = context.tabs[partId];
      const def = CnS5CharacterSheet.TAB_DEFINITIONS.find((t) => t.id === partId);
      if (def?.planned) context.planned = `CNS5.Planned.${def.planned}`;
    }
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
    for (const input of this.element.querySelectorAll('[data-action="editLevel"]')) {
      input.addEventListener("change", this.#onEditLevel.bind(this));
    }
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
  static async #onEditSkill(event, target) {
    this.actor.items.get(target.dataset.itemId)?.sheet.render({ force: true });
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static async #onDeleteSkill(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("CNS5.Skill.delete") },
      content: `<p>${game.i18n.format("CNS5.Skill.deleteConfirm", { name: item.name })}</p>`
    });

    if (confirmed) await item.delete();
  }
}
