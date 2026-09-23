import { CNS5 } from "../config.mjs";
import { CnS5CreationWizard } from "../apps/creation-wizard.mjs";
import { CnS5UnskilledAttempt } from "../apps/unskilled.mjs";

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
      openWizard: CnS5CharacterSheet.#onOpenWizard,
      attemptUnskilled: CnS5CharacterSheet.#onAttemptUnskilled,
      castFromDevice: CnS5CharacterSheet.#onCastFromDevice,
      drawBeliefPool: CnS5CharacterSheet.#onDrawBeliefPool,
      removeDeviceSpell: CnS5CharacterSheet.#onRemoveDeviceSpell
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

    context.ammunition = this.actor.items.filter((i) => i.type === "ammunition").sort(byName);
    // One item type, shown by kind: they are used differently enough to want
    // different columns, which is what made them all read alike in one table.
    const magickal = this.actor.items.filter((i) => i.type === "magickalItem").sort(byName);
    context.foci = magickal.filter((i) => i.system.kind === "focus");
    context.devices = magickal.filter((i) => i.system.kind === "device");
    // Unread scrolls first: a crumbled one is kept for the record, not for use.
    context.scrolls = magickal
      .filter((i) => i.system.kind === "scroll")
      .sort((a, b) => Number(a.system.discharged) - Number(b.system.discharged));

    // A book is either the character's own — spells he is learning — or
    // someone else's, read like a scroll. They are used so differently that
    // they are shown apart.
    const books = magickal.filter((i) => i.system.kind === "book");
    const mine = (book) => !book.system.writtenBy || book.system.writtenBy === this.actor.name;
    context.ownBooks = books.filter(mine);
    // What stands between the character and a spell cast at him (p298).
    context.wards = magickal.filter((i) => ["ward", "amulet"].includes(i.system.kind));
    context.otherBooks = books.filter((b) => !mine(b));
    context.talents = this.actor.items.filter((i) => i.type === "talent").sort(byName);
    context.flaws = this.actor.items.filter((i) => i.type === "flaw").sort(byName);

    // Flaws grant PC Points and talents cost them, so the net is what a player
    // wants to see when weighing one against the other.
    context.traitPoints =
      context.flaws.reduce((total, f) => total + (f.system.pcBonus ?? 0), 0) -
      context.talents.reduce((total, t) => total + (t.system.pcCost ?? 0), 0);

    // Protection is shown by location rather than as one total: an unaimed
    // blow strikes the torso, and a helm has no part in stopping it.
    // Parts protected identically share a row, and a part protected by nothing
    // gets none. A shield is listed apart, being interposed rather than worn.
    const shield = system.shieldProtection;
    context.protectionRows = [
      ...system.protectionSummary,
      ...(Object.values(shield).some((v) => v > 0)
        ? [{
            key: "shield",
            label: ["CNS5.Armour.shields"],
            tooltip: "CNS5.Armour.shieldHint",
            values: shield
          }]
        : [])
    ];

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
    context.standings = this.#choices(CNS5.holyStandings, system.details.holyStanding);
    const labelled = (table) =>
      Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.label]));
    context.congregations = this.#choices(labelled(CNS5.congregations), system.faith.congregation);
    context.holyPlaces = this.#choices(labelled(CNS5.holyPlaces), system.faith.holyPlace);
    context.shrines = this.#choices(labelled(CNS5.shrines), system.faith.shrine);
    context.signs = this.#choices(
      Object.fromEntries(Object.entries(CNS5.birthSigns).map(([k, v]) => [k, v.label])),
      system.details.sign
    );
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
      // Ammunition is gear as much as it is part of a shot: it is carried, it
      // weighs something, and it counts against what a character can bear.
      { id: "arms", label: "CNS5.Item.arms", types: ["weapon", "armour", "ammunition"] },
      { id: "magickal", label: "CNS5.Magickal.heading", types: ["magickalItem"] }
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
        (s) =>
          s.system.kind !== "competency" &&
          s.system.known &&
          s.system.category === category
      );
      if (inCategory.length) {
        groups.push({
          id: category,
          label: CNS5.skillCategories[category].label,
          skills: inCategory
        });
      }
    }

    // Skills without basic knowledge stand apart, whatever category they would
    // fall into once learnt. They roll on a different line of the table — the
    // Unskilled chance rather than the Skilled one — and mixing them in with
    // skills the character actually has makes a sheet that reads as though they
    // do. The category is kept on each rather than replaced by this grouping,
    // because it says what the skill will be worth once it is bought, which is
    // exactly what a player is deciding when they look at this list.
    const untrained = skills.filter(
      (s) => s.system.kind !== "competency" && !s.system.known
    );
    if (untrained.length) {
      groups.push({
        id: "untrained",
        label: "CNS5.Skill.untrained",
        hint: "CNS5.Skill.untrainedHint",
        untrained: true,
        skills: untrained
      });
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
  }

  /* -------------------------------------------- */

  /**
   * Write a skill level edited in the table back to its item.
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
   * Draw the Belief Pool from the congregation.
   * @this {CnS5CharacterSheet}
   */
  static async #onDrawBeliefPool() {
    await this.actor.drawBeliefPool();
  }

  /* -------------------------------------------- */

  /**
   * Activate a spell held in a Device.
   * @this {CnS5CharacterSheet}
   */
  static async #onCastFromDevice(event, target) {
    await this.actor.castFromDevice(target.dataset.itemId, Number(target.dataset.index));
  }

  /* -------------------------------------------- */

  /**
   * Take a spell out of a Device, from the Magick tab.
   *
   * Asked first: it is one small cross beside the button that casts the
   * spell, and taking a spell out loses what was recorded of it. A slip of the
   * mouse should not empty a wand.
   *
   * @this {CnS5CharacterSheet}
   */
  static async #onRemoveDeviceSpell(event, target) {
    const device = this.actor.items.get(target.dataset.itemId);
    const index = Number(target.dataset.index);
    const held = device?.system.spells[index];
    if (!held) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("CNS5.Device.remove") },
      content: `<p>${game.i18n.format("CNS5.Device.removeConfirm", {
        spell: held.name,
        item: device.name
      })}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;

    await device.update({
      "system.spells": device.system.spells.filter((_, i) => i !== index)
    });
  }

  /* -------------------------------------------- */

  /**
   * Attempt a skill the character never learnt.
   * @this {CnS5CharacterSheet}
   */
  static async #onAttemptUnskilled() {
    await CnS5UnskilledAttempt.prompt(this.actor);
  }

  /* -------------------------------------------- */

  /** @this {CnS5CharacterSheet} */
  static #onOpenWizard() {
    new CnS5CreationWizard(this.actor).render({ force: true });
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

  /**
   * Create a blank item of the type named on the button and open it.
   * @this {CnS5CharacterSheet}
   */
  static async #onCreateItem(event, target) {
    const type = target.dataset.type;
    if (!type) return;

    // A magickal item is one type of three kinds, each with a section of its
    // own; the button under Scrolls should make a scroll, not a Device that has
    // then to be changed into one.
    const kind = target.dataset.kind;
    const data = {
      name: game.i18n.localize(kind ? `CNS5.Item.new.${kind}` : `CNS5.Item.new.${type}`),
      type
    };
    if (kind) data.system = { kind };

    const [item] = await this.actor.createEmbeddedDocuments("Item", [data]);
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
}
