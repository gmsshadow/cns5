import { CNS5 } from "../config.mjs";
import { clampSuccessChance, resolveCheck, checkToMessage } from "../helpers/checks.mjs";

/**
 * A roll against a chance typed in by hand.
 *
 * Everything else in the system rolls against something it can look up — a
 * skill, a weapon, an Act of Faith. This is for the rest of a session: a
 * Gamemaster calling for a check against a number they have just decided, or a
 * player rolling for something the sheet has no entry for.
 *
 * The Difficulty Factor is optional and that is the point. Give one and the
 * roll behaves like any other: the chance is clamped to that Factor's band and
 * whatever falls outside it becomes a Crit Die modifier. Leave it out and the
 * number typed in is simply the number to roll under, which is what someone
 * improvising a check usually means.
 */
export class CnS5QuickRoll {
  /**
   * Ask for a chance and roll against it.
   *
   * @param {object} [options]
   * @param {number} [options.chance]  skip the prompt and roll against this
   * @param {number|null} [options.df]  the Difficulty Factor band, if any
   * @returns {Promise<ChatMessage|null>}
   */
  static async prompt({ chance = null, df = null } = {}) {
    const answer = chance === null ? await CnS5QuickRoll.#ask() : { chance, df };
    if (answer === null) return null;

    return CnS5QuickRoll.roll(answer);
  }

  /* -------------------------------------------- */

  /**
   * @returns {Promise<{chance: number, df: number|null, label: string}|null>}
   */
  static async #ask() {
    const difficulties = Object.entries(CNS5.difficultyFactors)
      .map(
        ([key, band]) =>
          `<option value="${key}">${key} — ${game.i18n.localize(`CNS5.Difficulty.${key}`)}
           (${band.min}-${band.max}%)</option>`
      )
      .join("");

    const content = `
      <div class="cns5-prompt">
        <label for="cns5-quick-chance">${game.i18n.localize("CNS5.Quick.chance")}</label>
        <input id="cns5-quick-chance" type="number" name="chance" value="50"
               min="1" max="100" step="1" autofocus>

        <label for="cns5-quick-label">${game.i18n.localize("CNS5.Quick.label")}</label>
        <input id="cns5-quick-label" type="text" name="label"
               placeholder="${game.i18n.localize("CNS5.Quick.labelPlaceholder")}">

        <label for="cns5-quick-df">${game.i18n.localize("CNS5.Quick.df")}</label>
        <select id="cns5-quick-df" name="df">
          <option value="">${game.i18n.localize("CNS5.Quick.noDf")}</option>
          ${difficulties}
        </select>
        <p class="hint">${game.i18n.localize("CNS5.Quick.dfHint")}</p>
      </div>`;

    return foundry.applications.api.DialogV2.prompt({
      window: { title: game.i18n.localize("CNS5.Quick.title") },
      content,
      ok: {
        label: game.i18n.localize("CNS5.Roll.rollButton"),
        callback: (event, button) => {
          const form = button.form.elements;
          const value = Number(form.chance.value);
          return {
            chance: Number.isFinite(value) ? Math.clamp(Math.round(value), 1, 100) : 50,
            df: form.df.value ? Number(form.df.value) : null,
            label: form.label.value?.trim() ?? ""
          };
        }
      },
      rejectClose: false
    });
  }

  /* -------------------------------------------- */

  /**
   * Roll against a chance and post it.
   *
   * @param {object} options
   * @returns {Promise<ChatMessage>}
   */
  static async roll({ chance, df = null, label = "" }) {
    // With a Difficulty Factor the chance is clamped to its band and the
    // surplus becomes a Crit Die modifier, exactly as a skill check does.
    // Without one, the number given is the number to roll under.
    const banded = df ? clampSuccessChance(chance, df) : null;
    const target = banded ? banded.target : chance;

    const result = await resolveCheck({ target, critMod: banded?.critMod ?? 0 });

    // Whoever is speaking, if anyone: the selected token, else the user's own
    // character. A roll made by a Gamemaster with nothing selected simply has
    // no speaker, which is correct rather than a fallback.
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user.character ?? null;

    return checkToMessage(actor, {
      ...result,
      title: label || game.i18n.localize("CNS5.Quick.title"),
      subtitle: df
        ? game.i18n.format("CNS5.Quick.subtitleBanded", {
            df,
            difficulty: game.i18n.localize(`CNS5.Difficulty.${df}`),
            target
          })
        : game.i18n.format("CNS5.Quick.subtitle", { target }),
      unclamped: banded ? chance : null,
      overflow: banded?.overflow ?? 0,
      shortfall: banded?.shortfall ?? 0,
      breakdown: [
        {
          label: game.i18n.localize("CNS5.Quick.chance"),
          value: `${chance}`
        }
      ]
    });
  }
}

/* -------------------------------------------- */

/**
 * Put a button beside the macro bar.
 *
 * The hotbar is where a player's hand already is, and a free-form roll is
 * wanted often enough that burying it in a macro would be a poor trade. The
 * button is rebuilt on every render because Foundry replaces the element.
 *
 * @param {HTMLElement} element  the hotbar's root element
 */
export function addQuickRollButton(element) {
  if (!element || element.querySelector(".cns5-quick-roll")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "cns5-quick-roll";
  button.dataset.tooltip = game.i18n.localize("CNS5.Quick.tooltip");
  button.setAttribute("aria-label", game.i18n.localize("CNS5.Quick.title"));
  button.innerHTML = '<i class="fa-solid fa-percent"></i>';
  button.addEventListener("click", () => CnS5QuickRoll.prompt());

  element.prepend(button);
}
