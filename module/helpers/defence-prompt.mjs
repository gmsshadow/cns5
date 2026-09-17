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
export async function promptShot(weapon, loadings, shooter, penalties = {}) {
  const strength = shooter?.attr?.str?.value ?? 0;
  const strong = strength >= CNS5.rangedStrengthMinimum;

  const options = loadings
    .map(
      ({ item, profile }, index) =>
        `<option value="${index}">${item?.name ?? profile.ammunition ?? weapon.name}
         — ${game.i18n.format("CNS5.Missile.damageIs", { damage: profile.baseDamage })}
         ${item ? ` (${item.system.quantity})` : ""}</option>`
    )
    .join("");

  const assumed = loadings.length === 1 && loadings[0].assumed;

  /**
   * The brackets for one loading.
   *
   * A bracket is printed in the book and then lengthened by a strong arm, and
   * the two are shown apart. Adding them silently produced a figure — a short
   * bow reaching 700 feet — that appears nowhere in the rulebook and cannot be
   * checked against it.
   *
   * @param {object} profile
   * @returns {string}
   */
  const bandOptions = (profile) =>
    CNS5.rangeBands
      .map((band) => {
        const printed = profile?.ranges?.[band] ?? 0;
        const extra = CNS5.rangedStrengthBonus(strength, band);
        const modifier = profile?.critModifiers?.[band] ?? 0;
        const reach = extra ? `${printed} + ${extra} = ${printed + extra}ft` : `${printed}ft`;

        // Distance costs a shot its chance as well as its Crit Die, and the
        // chance is what a player is choosing between, so it is shown first.
        const penalty = penalties[band] ?? 0;
        const toHit = penalty ? `${penalty}% ${game.i18n.localize("CNS5.Missile.toHit")}, ` : "";

        return `<option value="${band}">${game.i18n.localize(`CNS5.Range.${band}`)}
                — ${reach}, ${toHit}${modifier >= 0 ? "+" : ""}${modifier}
                ${game.i18n.localize("CNS5.Missile.toCritDie")}</option>`;
      })
      .join("");

  const content = `
    <div class="cns5-prompt">
      <label for="cns5-ammo">${game.i18n.localize("CNS5.Missile.loadedWith")}</label>
      <select id="cns5-ammo" name="ammunition" ${loadings.length === 1 ? "disabled" : ""}>
        ${options}
      </select>
      ${
        assumed
          ? `<p class="hint cns5-hint--bad">${game.i18n.format("CNS5.Missile.assumed", {
              ammunition: loadings[0].profile.ammunition ?? weapon.name
            })}</p>`
          : ""
      }
      <label for="cns5-band">${game.i18n.localize("CNS5.Missile.range")}</label>
      <select id="cns5-band" name="band">${bandOptions(loadings[0]?.profile)}</select>
      <p class="hint">${game.i18n.localize("CNS5.Missile.rangeHint")}</p>
      ${
        strong
          ? `<p class="hint">${game.i18n.format("CNS5.Missile.strongArm", { strength })}</p>`
          : ""
      }
    </div>`;

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("CNS5.Missile.title", { weapon: weapon.name }) },
    content,

    /**
     * Rebuild the brackets when the loading changes.
     *
     * The ranges belong to the pairing, so a bow's reach with hunting arrows is
     * not its reach with armour-piercing ones. Listing the first loading's
     * brackets and leaving them there meant choosing different arrows changed
     * the damage and the Crit Die but not the distances.
     */
    render: (event, dialog) => {
      const ammo = dialog.element.querySelector("#cns5-ammo");
      const bandSelect = dialog.element.querySelector("#cns5-band");
      if (!ammo || !bandSelect) return;

      ammo.addEventListener("change", () => {
        const chosen = bandSelect.value;
        bandSelect.innerHTML = bandOptions(loadings[Number(ammo.value)]?.profile);
        // Keep the bracket the player had picked, now read off the new loading.
        bandSelect.value = chosen;
      });
    },

    ok: {
      label: game.i18n.localize("CNS5.Roll.rollButton"),
      callback: (event, button) => {
        // A disabled control submits no value, so a single loading falls back
        // to its own index rather than to nothing.
        const raw = button.form.elements.ammunition?.value;
        const index = raw === undefined || raw === "" ? 0 : Number(raw);
        return {
          loading: Number.isFinite(index) ? index : 0,
          band: button.form.elements.band.value
        };
      }
    },
    rejectClose: false
  });
}

/* -------------------------------------------- */

/**
 * Ask whether a weapon is being swung or thrown.
 *
 * Throwing is an action rather than a kind of weapon: a War Axe is a weapon to
 * swing that can also be hurled, and the rules give it a profile for each. So
 * the question is put when the weapon is used rather than settled when it is
 * bought, and both answers show what they are worth — the two differ in damage,
 * in skill and in Difficulty Factor.
 *
 * @param {Item} weapon
 * @param {object} profile  the thrown profile from the ranges table
 * @returns {Promise<"strike"|"throw"|null>} null if dismissed
 */
export async function promptThrow(weapon, profile) {
  const hurling = CNS5.hurlingSkillFor(weapon.name);

  const content = `
    <div class="cns5-prompt">
      <p>${game.i18n.format("CNS5.Throw.prompt", { weapon: weapon.name })}</p>
      <p class="hint">${game.i18n.format("CNS5.Throw.strikeHint", {
        damage: weapon.system.damage,
        skill: weapon.system.resolvedSkill || weapon.system.skill || "—"
      })}</p>
      <p class="hint">${game.i18n.format("CNS5.Throw.throwHint", {
        damage: profile.baseDamage,
        skill: hurling || "—"
      })}</p>
    </div>`;

  return foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.format("CNS5.Throw.title", { weapon: weapon.name }) },
    content,
    buttons: [
      {
        action: "strike",
        label: game.i18n.localize("CNS5.Throw.strike"),
        default: true,
        callback: () => "strike"
      },
      {
        action: "throw",
        label: game.i18n.localize("CNS5.Throw.throw"),
        callback: () => "throw"
      }
    ],
    rejectClose: false
  });
}

/* -------------------------------------------- */

/**
 * Ask how a spell is being cast and what stands in its way.
 *
 * Everything here bears on targeting rather than on casting, and most of it is
 * ordinarily nothing: a caster standing still, throwing a spell at someone in
 * plain view at close range, answers none of these questions. So the dialog
 * opens with the two that always matter — where the mana is and where the spell
 * is being read from — and lists the rest as boxes to tick.
 *
 * @param {Item} spell
 * @param {object} options
 * @returns {Promise<object|null>} null if dismissed
 */
export async function promptTargeting(spell, { tables, resistance, targetName }) {
  const boxes = (list, name) =>
    list
      .map(
        (entry) => `
        <label class="cns5-checkbox">
          <input type="checkbox" name="${name}" value="${entry.id}">
          <span>${entry.label}
            <span class="cns5-hint">${
              entry.impenetrable
                ? game.i18n.localize("CNS5.Targeting.impenetrable")
                : `${entry.modifier > 0 ? "+" : ""}${entry.modifier}%`
            }</span>
          </span>
        </label>`
      )
      .join("");

  const choices = (source, selected) =>
    Object.entries(source)
      .map(
        ([key, entry]) =>
          `<option value="${key}" ${key === selected ? "selected" : ""}>${game.i18n.localize(
            entry.label
          )}</option>`
      )
      .join("");

  const content = `
    <div class="cns5-prompt">
      <div class="cns5-grid cns5-grid--two">
        <label class="cns5-field">
          <span>${game.i18n.localize("CNS5.Targeting.mana")}</span>
          <select name="mana">${choices(CNS5.manaLevels, "average")}</select>
        </label>
        <label class="cns5-field">
          <span>${game.i18n.localize("CNS5.Targeting.source")}</span>
          <select name="source">${choices(CNS5.castingSources, "memory")}</select>
        </label>
        <label class="cns5-field">
          <span>${game.i18n.localize("CNS5.Targeting.range")}</span>
          <select name="range">
            ${Object.keys(CNS5.spellRanges)
              .map(
                (key) =>
                  `<option value="${key}">${game.i18n.localize(`CNS5.Range.${key}`)}
                   (${CNS5.spellRanges[key].modifier}%)</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="cns5-field">
          <span>${game.i18n.localize("CNS5.Targeting.dodge")}</span>
          <input type="number" name="dodgePsf" value="0" min="0">
        </label>
      </div>

      ${
        targetName
          ? `<p class="hint">${game.i18n.format("CNS5.Targeting.resists", {
              name: targetName,
              mr: resistance.value,
              matched: resistance.matched ?? game.i18n.localize("CNS5.Targeting.unknownKind")
            })}</p>`
          : `<label class="cns5-field">
               <span>${game.i18n.localize("CNS5.Targeting.resistance")}</span>
               <input type="number" name="resistance" value="0" min="0">
             </label>`
      }

      <label class="cns5-checkbox">
        <input type="checkbox" name="willing">
        <span>${game.i18n.format("CNS5.Targeting.willing", {
          bonus: CNS5.willingTargetBonus
        })}</span>
      </label>
      <label class="cns5-checkbox">
        <input type="checkbox" name="extendRange">
        <span>${game.i18n.localize("CNS5.Targeting.extend")}</span>
      </label>

      <p class="cns5-check__subheading">${game.i18n.localize("CNS5.Targeting.movement")}</p>
      ${boxes(tables.movement, "movement")}

      <p class="cns5-check__subheading">${game.i18n.localize("CNS5.Targeting.obstacles")}</p>
      ${boxes(tables.obstacles, "obstacles")}

      <label class="cns5-field">
        <span>${game.i18n.localize("CNS5.Roll.situational")}</span>
        <input type="number" name="situational" value="0">
      </label>
      <p class="hint">${game.i18n.localize("CNS5.Targeting.dodgeHint")}</p>

      <p class="cns5-check__subheading">${game.i18n.localize("CNS5.Save.label")}</p>
      <p class="hint">${game.i18n.localize("CNS5.Save.hint")}</p>
      <label class="cns5-checkbox">
        <input type="checkbox" name="mantra">
        <span>${game.i18n.localize("CNS5.Save.mantra")} (-5%)</span>
      </label>
      <label class="cns5-checkbox">
        <input type="checkbox" name="dancing">
        <span>${game.i18n.localize("CNS5.Save.dancing")} (-5%)</span>
      </label>
      <label class="cns5-checkbox">
        <input type="checkbox" name="smokes">
        <span>${game.i18n.localize("CNS5.Save.smokes")} (-10%)</span>
      </label>
      <label class="cns5-field">
        <span>${game.i18n.localize("CNS5.Save.meditation")}</span>
        <input type="number" name="meditationDays" value="0" min="0" max="25">
      </label>
    </div>`;

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.format("CNS5.Targeting.title", { spell: spell.name }) },
    content,
    position: { width: 520 },
    ok: {
      label: game.i18n.localize("CNS5.Roll.rollButton"),
      callback: (event, button) => {
        const form = button.form;
        const ticked = (name) =>
          [...form.querySelectorAll(`[name="${name}"]:checked`)].map((b) => b.value);

        return {
          mana: form.elements.mana.value,
          source: form.elements.source.value,
          range: form.elements.range.value,
          dodgePsf: Math.max(0, Number(form.elements.dodgePsf.value) || 0),
          resistance: form.elements.resistance
            ? Math.max(0, Number(form.elements.resistance.value) || 0)
            : null,
          willing: form.elements.willing.checked,
          extendRange: form.elements.extendRange.checked,
          movement: ticked("movement"),
          obstacles: ticked("obstacles"),
          situational: Number(form.elements.situational.value) || 0,
          // What the caster does to make the spell harder to shrug off.
          saveReductions: {
            mantra: form.elements.mantra.checked,
            dancing: form.elements.dancing.checked,
            smokes: form.elements.smokes.checked,
            meditationDays: Math.max(0, Number(form.elements.meditationDays.value) || 0)
          }
        };
      }
    },
    rejectClose: false
  });
}
