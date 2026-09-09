import { CNS5 } from "../config.mjs";
import { defenceSkill } from "./defence.mjs";

export { basicDefence, rollDefence, resolveExchange, checkShield } from "./defence.mjs";

/**
 * Ask the target how they are defending.
 *
 * The rules have the defender declare before the attack is rolled, so this is
 * asked by whoever is making the attack rather than waiting on the defender's
 * own client. That is a compromise: it keeps the exchange to one uninterrupted
 * sequence at the cost of the defender's player not pressing the button
 * themselves. A GM running the monsters is the usual case either way.
 *
 * Only defences the target could actually make are offered. There is no sense
 * offering a shield block to somebody carrying no shield, or a parry to
 * somebody with nothing in hand.
 *
 * @param {Actor} defender
 * @param {string} mode  "basic" or "advanced"
 * @returns {Promise<string|null>} the defence key, or null if dismissed
 */
export async function promptDefence(defender, mode) {
  const options = [];

  for (const [key, entry] of Object.entries(CNS5.defences)) {
    if (key === "none") continue;

    // A passive defence needs nothing in particular; the active ones each need
    // something the defender may not have.
    if (key === "passive") {
      options.push({ key, label: entry.label, detail: "" });
      continue;
    }

    const found = defenceSkill(defender, key);
    if (!found.skill) continue;

    const detail = [
      found.itemName,
      `${found.skill.name} ${found.skill.system.target}%`,
      found.bonus ? `+${found.bonus}%` : null
    ]
      .filter(Boolean)
      .join(", ");

    options.push({ key, label: entry.label, detail });
  }

  const rows = options
    .map(
      (option) => `
        <label class="cns5-checkbox">
          <input type="radio" name="defence" value="${option.key}">
          <span>${game.i18n.localize(option.label)}${
            option.detail ? ` <span class="cns5-hint">— ${option.detail}</span>` : ""
          }</span>
        </label>`
    )
    .join("");

  const content = `
    <div class="cns5-prompt">
      <p>${game.i18n.format("CNS5.Defence.prompt", { name: defender.name })}</p>
      <label class="cns5-checkbox">
        <input type="radio" name="defence" value="none" checked>
        <span>${game.i18n.localize("CNS5.Defence.none")}</span>
      </label>
      ${rows}
      <p class="hint">${game.i18n.localize(
        mode === "basic" ? "CNS5.Defence.basicHint" : "CNS5.Defence.advancedHint"
      )}</p>
    </div>`;

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("CNS5.Defence.title", { name: defender.name }) },
    content,
    ok: {
      label: game.i18n.localize("CNS5.Defence.declare"),
      callback: (event, button) => button.form.elements.defence.value ?? "none"
    },
    rejectClose: false
  });
}
