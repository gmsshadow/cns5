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
    if (!found.usable) continue;

    const detail = [
      found.item?.name,
      `${found.name} ${found.psf >= 0 ? "+" : ""}${found.psf}%`,
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


/* -------------------------------------------- */

/**
 * Ask what a launcher is loaded with and how far the shot is.
 *
 * Both belong to the shot rather than to the bow: Table - Missile Ranges gives
 * a pairing its damage and its brackets, and until the arrow and the distance
 * are known there is nothing to look up.
 *
 * @param {Item} weapon
 * @param {Array<{item: Item, profile: object}>} loadings
 * @param {object} shooter  the shooter's system data
 * @returns {Promise<{ammunitionId: string|null, band: string}|null>}
 */
export async function promptShot(weapon, loadings, shooter) {
  const strength = shooter?.attr?.str?.value ?? 0;

  const options = loadings
    .map(
      ({ item, profile }) =>
        `<option value="${item?.id ?? ""}">${item?.name ?? profile.ammunition ?? weapon.name}
         — ${game.i18n.format("CNS5.Missile.damageIs", { damage: profile.baseDamage })}
         ${item ? ` (${item.system.quantity})` : ""}</option>`
    )
    .join("");

  const first = loadings[0]?.profile;
  const bands = CNS5.rangeBands
    .map((band) => {
      const reach = (first?.ranges?.[band] ?? 0) + CNS5.rangedStrengthBonus(strength, band);
      const modifier = first?.critModifiers?.[band] ?? 0;
      return `<option value="${band}">${game.i18n.localize(`CNS5.Range.${band}`)}
              — ${reach}ft, ${modifier >= 0 ? "+" : ""}${modifier}
              ${game.i18n.localize("CNS5.Missile.toCritDie")}</option>`;
    })
    .join("");

  const content = `
    <div class="cns5-prompt">
      ${
        loadings.length > 1 || loadings[0]?.item
          ? `<label for="cns5-ammo">${game.i18n.localize("CNS5.Missile.loadedWith")}</label>
             <select id="cns5-ammo" name="ammunition">${options}</select>`
          : ""
      }
      <label for="cns5-band">${game.i18n.localize("CNS5.Missile.range")}</label>
      <select id="cns5-band" name="band">${bands}</select>
      <p class="hint">${game.i18n.localize("CNS5.Missile.rangeHint")}</p>
      ${
        strength >= CNS5.rangedStrengthMinimum
          ? `<p class="hint">${game.i18n.format("CNS5.Missile.strongArm", { strength })}</p>`
          : ""
      }
    </div>`;

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("CNS5.Missile.title", { weapon: weapon.name }) },
    content,
    ok: {
      label: game.i18n.localize("CNS5.Roll.rollButton"),
      callback: (event, button) => ({
        ammunitionId: button.form.elements.ammunition?.value || null,
        band: button.form.elements.band.value
      })
    },
    rejectClose: false
  });
}
