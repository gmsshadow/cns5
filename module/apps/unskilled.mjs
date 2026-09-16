import { CNS5 } from "../config.mjs";

/**
 * Attempting a skill nobody taught you.
 *
 * "Some skills cannot be attempted unless the character has basic knowledge of
 * the skill" (p33), which means the rest can. A character with no Swimming
 * skill can still try to swim.
 *
 * The skill is chosen from the compendium and nothing is added to the sheet. A
 * skill a character does not have is not something they own, and listing every
 * skill they might one day attempt would be listing the whole book.
 */
export class CnS5UnskilledAttempt {
  /**
   * Ask which skill, then roll it.
   *
   * @param {Actor} actor
   * @returns {Promise<ChatMessage|null>}
   */
  static async prompt(actor) {
    const pack = game.packs.get("cns5.skills");
    if (!pack) {
      ui.notifications.warn(game.i18n.localize("CNS5.Skill.noCompendium"));
      return null;
    }

    const index = await pack.getIndex({ fields: ["system.df", "system.attributes",
      "system.trainingRequired", "system.reference"] });

    // Skills the character already has are left out: they would be rolled on
    // the sheet, at the Skilled chance, which is a different roll entirely.
    const known = new Set(
      actor.items.filter((i) => i.type === "skill").map((i) => i.name.toLowerCase())
    );

    const available = index
      .filter((entry) => !known.has(entry.name.toLowerCase()))
      .filter((entry) => !entry.system?.trainingRequired)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!available.length) {
      ui.notifications.info(game.i18n.localize("CNS5.Skill.nothingToAttempt"));
      return null;
    }

    const options = available
      .map((entry) => {
        const df = entry.system?.df ?? 3;
        const band = CNS5.difficultyFactors[df];
        return `<option value="${entry._id}">${entry.name}
                — ${game.i18n.localize(`CNS5.Difficulty.${df}`)}, ${band?.unskilled ?? 0}%
                </option>`;
      })
      .join("");

    const content = `
      <div class="cns5-prompt">
        <label for="cns5-unskilled">${game.i18n.localize("CNS5.Skill.chooseSkill")}</label>
        <select id="cns5-unskilled" name="skill">${options}</select>
        <p class="hint">${game.i18n.localize("CNS5.Skill.attemptHint")}</p>
      </div>`;

    const chosen = await foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CNS5.Skill.attemptUnskilled") },
      content,
      ok: {
        label: game.i18n.localize("CNS5.Roll.rollButton"),
        callback: (event, button) => button.form.elements.skill.value
      },
      rejectClose: false
    });

    if (!chosen) return null;

    const entry = available.find((e) => e._id === chosen);
    return actor.attemptUnskilled({
      name: entry.name,
      df: entry.system?.df ?? 3,
      attributes: entry.system?.attributes ?? [],
      trainingRequired: false
    });
  }
}
