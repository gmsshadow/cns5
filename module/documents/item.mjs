/**
 * The C&S Item.
 *
 * The only behaviour here guards against a character holding the same skill
 * twice, which would mean two independent levels for one ability. It lives on
 * the document rather than on the sheet because an item can arrive by drag and
 * drop, by macro, by import or from a compendium, and the rule should hold
 * whichever way it came.
 *
 * Everything else stacks. Three daggers is a normal thing to carry.
 */
export class CnS5Item extends Item {
  /** @inheritDoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    if (this.type !== "skill" || !this.parent) return;

    const duplicate = this.parent.items.find(
      (i) => i.type === "skill" && i.name.toLowerCase() === this.name.toLowerCase()
    );
    if (!duplicate) return;

    ui.notifications.warn(game.i18n.format("CNS5.Skill.duplicate", { name: this.name }));
    return false;
  }
}
