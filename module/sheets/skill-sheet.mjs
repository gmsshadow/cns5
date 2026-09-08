import { CNS5 } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/**
 * The skill item sheet.
 *
 * The live readout at the bottom is the point of this sheet: it shows the
 * assembled PSF% and TSC% alongside the Min%/Max% band, so a player editing a
 * level or toggling Mastery sees the consequence immediately rather than
 * recomputing it. When the skill is not on an actor there are no attributes to
 * draw on, so the readout is suppressed.
 */
export class CnS5SkillSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["cns5", "sheet", "item", "skill"],
    position: { width: 520, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      setAttribute: CnS5SkillSheet.#onSetAttribute
    }
  };

  /** @override */
  static PARTS = {
    body: { template: "systems/cns5/templates/item/skill-sheet.hbs" }
  };

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.item.system;

    context.system = system;
    context.editable = this.isEditable;
    context.config = CNS5;

    context.difficulties = Object.entries(CNS5.difficultyFactors).map(([df, band]) => ({
      value: Number(df),
      label: `${df} — ${game.i18n.localize(`CNS5.Difficulty.${df}`)}`,
      selected: Number(df) === system.df
    }));

    context.categories = Object.entries(CNS5.skillCategories).map(([key, cat]) => ({
      value: key,
      label: cat.label,
      selected: key === system.category
    }));

    context.origins = Object.entries(CNS5.skillOrigins).map(([key, label]) => ({
      value: key,
      label,
      selected: key === system.origin
    }));

    // Two independent selects, so "WIS x 2" is expressed by picking the same
    // attribute twice and a competency by leaving both blank.
    const allAttributes = Object.values(CNS5.attributeGroups).flat();
    context.attributeSlots = [0, 1].map((index) => ({
      index,
      options: [
        { value: "", label: "CNS5.Skill.attributeNone", selected: !system.attributes[index] },
        ...allAttributes.map((key) => ({
          value: key,
          label: `CNS5.Attribute.${key}.long`,
          selected: system.attributes[index] === key
        }))
      ]
    }));

    context.band = CNS5.difficultyFactors[system.df] ?? CNS5.difficultyFactors[3];
    context.onActor = Boolean(this.item.actor);
    context.descriptionHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      system.description,
      { relativeTo: this.item, secrets: this.item.isOwner }
    );

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Write one attribute slot, trimming trailing blanks so an unset second slot
   * leaves a single-attribute array rather than an array with a hole in it.
   *
   * @this {CnS5SkillSheet}
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onSetAttribute(event, target) {
    const index = Number(target.dataset.index);
    const attributes = [...this.item.system.attributes];
    attributes[index] = target.value;

    while (attributes.length && !attributes.at(-1)) attributes.pop();

    await this.item.update({ "system.attributes": attributes.filter(Boolean) });
  }
}
