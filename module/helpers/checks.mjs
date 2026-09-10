import { CNS5 } from "../config.mjs";

/**
 * The Skillskape resolution engine.
 *
 * Every check in Chivalry & Sorcery is the same shape: a Percentile Pair rolled
 * at or under a target, and a Crit Die rolled alongside it for magnitude. What
 * differs is how the target is assembled and what modifies the Crit Die.
 *
 * The awkward part of the rules lives in `clampSuccessChance`. A Total Success
 * Chance is capped by its Difficulty Factor's Min% and Max%, but the surplus is
 * not discarded: every 20% or part thereof outside the band shifts the Crit Die
 * in or against the character's favour. Doing that by hand is where tables lose
 * time, so the engine keeps the unclamped figure all the way through and only
 * clamps at the point of rolling.
 */

/**
 * Sign convention for Crit Die modifiers, used everywhere in this file:
 * a positive modifier is always in the character's favour. On a success it
 * raises the Crit Die total towards a Critical; on a failure it lowers the
 * total towards Heartbreaking. A negative modifier does the reverse.
 */

/* -------------------------------------------- */

/**
 * Apply the Min%/Max% band for a Difficulty Factor, converting any overflow or
 * shortfall into a Crit Die modifier (p37).
 *
 * @param {number} chance  the unclamped Total Success Chance
 * @param {number} df      the Difficulty Factor, 1-10
 * @returns {{target: number, critMod: number, overflow: number, shortfall: number}}
 */
export function clampSuccessChance(chance, df) {
  const band = CNS5.difficultyFactors[df] ?? CNS5.difficultyFactors[3];
  const result = { target: chance, critMod: 0, overflow: 0, shortfall: 0 };

  if (chance > band.max) {
    result.overflow = chance - band.max;
    result.target = band.max;
    result.critMod = Math.ceil(result.overflow / 20);
  } else if (chance < band.min) {
    result.shortfall = band.min - chance;
    result.target = band.min;
    result.critMod = -Math.ceil(result.shortfall / 20);
  }

  return result;
}

/* -------------------------------------------- */

/**
 * Roll a check and resolve it.
 *
 * @param {object} options
 * @param {number} options.target             the number to roll at or under
 * @param {number} [options.critMod]          Crit Die modifier, positive in the
 *                                            character's favour
 * @param {number} [options.failureCritMod]   an additional Crit Die modifier
 *                                            applied only on a failure, used for
 *                                            the unskilled attempt penalty (p38)
 * @returns {Promise<object>}
 */
export async function resolveCheck({ target, critMod = 0, failureCritMod = 0 }) {
  const pair = await new Roll("1d100").evaluate();
  const crit = await new Roll("1d10").evaluate();

  // A Percentile Pair result of 100 is the maximum, never a wrap to zero, so it
  // fails against any target below 100.
  const success = pair.total <= target;
  const applied = critMod + (success ? 0 : failureCritMod);
  const critTotal = success ? crit.total + applied : crit.total - applied;
  const outcome = CNS5.critOutcome(critTotal, success);

  // A ten on the Crit Die is always critical, whichever way the roll went and
  // whatever the modifiers would have made of it (p272). Otherwise a penalty
  // could take the edge off a roll the rules say is decisive.
  const critical = critTotal >= 10 || crit.total === 10;

  return {
    rolls: [pair, crit],
    target,
    roll: pair.total,
    critRaw: crit.total,
    critTotal,
    critMod: applied,
    success,
    outcome,
    critical,
    // A natural ten stands on its own, which is worth saying on the card.
    naturalCrit: crit.total === 10
  };
}

/* -------------------------------------------- */

/**
 * Render a resolved check to chat.
 *
 * @param {Actor} actor
 * @param {object} data  the result of resolveCheck, plus presentation fields
 * @returns {Promise<ChatMessage>}
 */
export async function checkToMessage(actor, data) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/cns5/templates/chat/check.hbs",
    {
      ...data,
      outcomeLabel: game.i18n.localize(
        `CNS5.Crit.${data.success ? "success" : "failure"}.${data.outcome}`
      ),
      resultLabel: game.i18n.localize(data.success ? "CNS5.Roll.success" : "CNS5.Roll.failure")
    }
  );

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: data.rolls,
    sound: CONFIG.sounds.dice
  });
}

/* -------------------------------------------- */

/**
 * Prompt for a situational modifier before rolling.
 *
 * @param {string} title
 * @param {object} [options]
 * @param {boolean} [options.aimedShot]  offer the aimed shot target areas too
 * @returns {Promise<{modifier: number, area: string}|null>} null if cancelled
 */
export async function promptModifier(title, { aimedShot = false } = {}) {
  let areas = "";
  if (aimedShot) {
    const options = Object.entries(CNS5.aimedShotModifiers)
      .map(([key, area]) => {
        const label = game.i18n.localize(area.label);
        const suffix = area.modifier ? ` (${area.modifier}%)` : "";
        return `<option value="${key}">${label}${suffix}</option>`;
      })
      .join("");
    areas = `
      <label for="cns5-area">${game.i18n.localize("CNS5.Roll.targetArea")}</label>
      <select id="cns5-area" name="area">${options}</select>`;
  }

  const content = `
    <div class="cns5-prompt">
      <label for="cns5-modifier">${game.i18n.localize("CNS5.Roll.situationalModifier")}</label>
      <input id="cns5-modifier" type="number" name="modifier" value="0" step="1" autofocus>
      ${areas}
      <p class="hint">${game.i18n.localize("CNS5.Roll.modifierHint")}</p>
    </div>`;

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    content,
    ok: {
      label: game.i18n.localize("CNS5.Roll.rollButton"),
      callback: (event, button) => ({
        modifier: Number(button.form.elements.modifier.value) || 0,
        area: button.form.elements.area?.value ?? "none"
      })
    },
    rejectClose: false
  });

  return result ?? null;
}
