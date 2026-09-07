import { CNS5 } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * The sheet for every item type except skills, which has its own because of the
 * live PSF readout.
 *
 * One class serves all of them, selecting a body template by item type. The
 * alternative — six near-identical subclasses — would duplicate the header,
 * the physical-item fields and the description editor five times over.
 */
export class CnS5ItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["cns5", "sheet", "item"],
    position: { width: 520, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  /** Body template per item type. */
  static BODIES = {
    weapon: "systems/cns5/templates/item/weapon-body.hbs",
    armour: "systems/cns5/templates/item/armour-body.hbs",
    equipment: "systems/cns5/templates/item/equipment-body.hbs",
    spell: "systems/cns5/templates/item/spell-body.hbs",
    actOfFaith: "systems/cns5/templates/item/act-of-faith-body.hbs",
    religion: "systems/cns5/templates/item/religion-body.hbs"
  };

  /** @override */
  static PARTS = {
    body: { template: "systems/cns5/templates/item/item-sheet.hbs" }
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.system = this.item.system;
    context.editable = this.isEditable;
    context.config = CNS5;
    context.bodyTemplate = CnS5ItemSheet.BODIES[this.item.type] ?? null;
    context.isPhysical = ["weapon", "armour", "equipment"].includes(this.item.type);
    context.onActor = Boolean(this.item.actor);

    context.weaponWeights = this.#choices(CNS5.weaponWeights, this.item.system.weightClass);
    context.armourWeights = this.#choices(CNS5.armourWeights, this.item.system.weightClass);
    context.damageTypes = this.#choices(CNS5.damageTypes, this.item.system.damageType);
    context.armourLocations = this.#choices(CNS5.armourLocations, this.item.system.location);

    context.descriptionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item.system.description ?? "",
      { relativeTo: this.item, secrets: this.item.isOwner }
    );

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Turn a config map into select options, marking the current value.
   * Entries may be a bare label string or an object carrying one.
   *
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
}
