import { CNS5 } from "../config.mjs";
import { CnS5CreationWizard } from "../apps/creation-wizard.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * The non-player character sheet.
 *
 * Deliberately one page rather than six. A GM opens this mid-scene to find a
 * number, so everything a boar can do sits in view at once: its vitals, what it
 * attacks with, what its hide absorbs, and the handful of skills the bestiary
 * bothers to give it.
 *
 * Attributes are shown only for a person. A creature has none — the bestiary
 * settles its Body and Fatigue directly — so showing an empty attribute grid
 * would be inviting someone to fill in numbers that mean nothing.
 */
export class CnS5NPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /* -------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["cns5", "sheet", "actor", "npc"],
    position: { width: 720, height: 700 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      rollAttribute: CnS5NPCSheet.#onRollAttribute,
      rollSkill: CnS5NPCSheet.#onRollSkill,
      rollWeapon: CnS5NPCSheet.#onRollWeapon,
      createItem: CnS5NPCSheet.#onCreateItem,
      editItem: CnS5NPCSheet.#onEditItem,
      deleteItem: CnS5NPCSheet.#onDeleteItem,
      toggleEquipped: CnS5NPCSheet.#onToggleEquipped,
      openWizard: CnS5NPCSheet.#onOpenWizard
    }
  };

  /** @override */
  static PARTS = {
    body: { template: "systems/cns5/templates/actor/npc-sheet.hbs", scrollable: [""] }
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    context.system = system;
    context.fields = system.schema.fields;
    context.editable = this.isEditable;
    context.config = CNS5;
    context.isCreature = system.kind === "creature";

    context.kinds = this.#choices(CNS5.npcKinds, system.kind);
    context.qualities = this.#choices(CNS5.npcQuality, system.quality);
    context.tiers = this.#choices(CNS5.npcTier, system.tier);

    context.groups = Object.entries(CNS5.attributeGroups).map(([group, keys]) => ({
      id: group,
      label: `CNS5.AttributeGroup.${group}`,
      attributes: keys.map((key) => ({
        ...system.attr[key],
        label: `CNS5.Attribute.${key}.long`,
        path: system.attr[key].derived
          ? `system.derived.${key}.mod`
          : `system.attributes.${key}.value`,
        editValue: system.attr[key].derived ? system.derived[key].mod : system.attr[key].value
      }))
    }));

    const byName = (a, b) => a.name.localeCompare(b.name);
    context.weapons = this.actor.items.filter((i) => i.type === "weapon").sort(byName);
    context.armour = this.actor.items.filter((i) => i.type === "armour").sort(byName);
    context.skills = this.actor.items.filter((i) => i.type === "skill").sort(byName);

    context.biographyHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.biography,
      { relativeTo: this.actor, secrets: this.actor.isOwner }
    );

    return context;
  }

  /* -------------------------------------------- */

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

  /** @this {CnS5NPCSheet} */
  static async #onRollAttribute(event, target) {
    const attribute = target.dataset.attribute;
    if (attribute) await this.actor.rollAttribute(attribute, { skipDialog: event.shiftKey });
  }

  /** @this {CnS5NPCSheet} */
  static async #onRollSkill(event, target) {
    await this.actor.rollSkill(target.dataset.itemId, { skipDialog: event.shiftKey });
  }

  /** @this {CnS5NPCSheet} */
  static async #onRollWeapon(event, target) {
    await this.actor.rollWeapon(target.dataset.itemId, { skipDialog: event.shiftKey });
  }

  /* -------------------------------------------- */

  /** @this {CnS5NPCSheet} */
  static async #onCreateItem(event, target) {
    const type = target.dataset.type;
    if (!type) return;

    const data = { name: game.i18n.localize(`CNS5.Item.new.${type}`), type };
    // A new attack on a creature is a natural one: it starts with a flat chance
    // of its own rather than looking for a skill that will never exist.
    if (type === "weapon" && this.actor.system.kind === "creature") {
      data.system = { psfOverride: 0, weightClass: "naturalMedium" };
    }

    const [item] = await this.actor.createEmbeddedDocuments("Item", [data]);
    item?.sheet.render({ force: true });
  }

  /** @this {CnS5NPCSheet} */
  static async #onEditItem(event, target) {
    this.actor.items.get(target.dataset.itemId)?.sheet.render({ force: true });
  }

  /** @this {CnS5NPCSheet} */
  static async #onDeleteItem(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (!item) return;

    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("CNS5.Item.delete") },
      content: `<p>${game.i18n.format("CNS5.Skill.deleteConfirm", { name: item.name })}</p>`
    });
    if (confirmed) await item.delete();
  }

  /** @this {CnS5NPCSheet} */
  static async #onToggleEquipped(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item) await item.update({ "system.equipped": !item.system.equipped });
  }

  /** @this {CnS5NPCSheet} */
  static #onOpenWizard() {
    new CnS5CreationWizard(this.actor).render({ force: true });
  }
}
