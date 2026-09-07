import { CNS5 } from "../config.mjs";
import {
  clampSuccessChance,
  resolveCheck,
  checkToMessage,
  promptModifier
} from "../helpers/checks.mjs";

/**
 * The C&S Actor.
 *
 * Both roll paths funnel into the same engine in helpers/checks.mjs. An
 * Attribute Roll is the degenerate case: a flat target from the AR% table with
 * no Difficulty Factor band to clamp against. A skill check assembles its target
 * from BCS% plus PSF% plus the situational modifier, then clamps to the Min%
 * and Max% for its Difficulty Factor and converts the surplus into a Crit Die
 * modifier.
 */
export class CnS5Actor extends Actor {
  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareBaseData() {
    // v14 resets the Active Effect phase tracker inside _clearData(), which is
    // called from the core prepareBaseData. Skipping super throws on the second
    // preparation cycle, which only shows up after the first document update.
    super.prepareBaseData();
  }

  /* -------------------------------------------- */

  /**
   * Roll an Attribute Roll (AR).
   *
   * @param {string} attribute        an attribute key, e.g. "str"
   * @param {object} [options]
   * @param {number} [options.modifier]  a percentage modifier to the AR%
   * @param {boolean} [options.skipDialog]
   * @returns {Promise<ChatMessage|null>}
   */
  async rollAttribute(attribute, { modifier = 0, skipDialog = false } = {}) {
    const attr = this.system.attr?.[attribute];
    if (!attr) throw new Error(`CnS5 | Unknown attribute "${attribute}" on ${this.name}`);

    const label = game.i18n.localize(`CNS5.Attribute.${attribute}.long`);
    const title = game.i18n.format("CNS5.Roll.attributeTitle", { attribute: label });

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted;
    }

    const target = Math.clamp(attr.ar + situational, 1, 100);
    const result = await resolveCheck({ target });

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format("CNS5.Roll.attributeSubtitle", {
        value: attr.value,
        target
      }),
      breakdown: this.#breakdown([
        { label: "CNS5.Roll.baseAr", value: attr.ar },
        { label: "CNS5.Roll.situational", value: situational, signed: true }
      ])
    });
  }

  /* -------------------------------------------- */

  /**
   * Roll a skill check.
   *
   * @param {string} itemId
   * @param {object} [options]
   * @param {number} [options.modifier]
   * @param {boolean} [options.skipDialog]
   * @returns {Promise<ChatMessage|null>}
   */
  async rollSkill(itemId, { modifier = 0, skipDialog = false } = {}) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "skill") {
      throw new Error(`CnS5 | No skill item ${itemId} on ${this.name}`);
    }

    const skill = item.system;

    // A skill marked [TR] cannot be guessed at: without basic knowledge there is
    // no chance of success to roll for (p38).
    if (!skill.attemptable) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Roll.trainingRequired", { skill: item.name })
      );
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.skillTitle", { skill: item.name });

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted;
    }

    // The unclamped chance carries the situational modifier before the band is
    // applied, because surplus above Max% and shortfall below Min% both survive
    // as Crit Die modifiers rather than being discarded (p37-38).
    const unclamped = skill.tsc + situational;
    const { target, critMod, overflow, shortfall } = clampSuccessChance(unclamped, skill.df);

    const result = await resolveCheck({
      target,
      critMod,
      failureCritMod: skill.failureCritMod
    });

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format("CNS5.Roll.skillSubtitle", {
        df: skill.df,
        difficulty: game.i18n.localize(`CNS5.Difficulty.${skill.df}`),
        target
      }),
      unclamped,
      overflow,
      shortfall,
      unskilled: !skill.known,
      breakdown: this.#breakdown([
        {
          label: skill.known ? "CNS5.Roll.bcsSkilled" : "CNS5.Roll.bcsUnskilled",
          value: skill.bcs
        },
        { label: "CNS5.Roll.psf", value: skill.psf, signed: true },
        { label: "CNS5.Roll.situational", value: situational, signed: true }
      ])
    });
  }

  /* -------------------------------------------- */

  /**
   * Add the nine skills every character has, skipping any already present.
   * A convenience for building characters by hand until the generated skill
   * compendium arrives.
   *
   * @returns {Promise<Item[]>}
   */
  async addCoreSkills() {
    const existing = new Set(
      this.items.filter((i) => i.type === "skill").map((i) => i.name.toLowerCase())
    );

    const toCreate = CNS5.coreSkills
      .filter((skill) => !existing.has(skill.name.toLowerCase()))
      .map((skill) => ({
        name: skill.name,
        type: "skill",
        system: {
          df: skill.df,
          attributes: skill.attributes,
          category: "core",
          known: true,
          level: 0
        }
      }));

    if (!toCreate.length) {
      ui.notifications.info(game.i18n.localize("CNS5.Skill.coreAlreadyPresent"));
      return [];
    }

    return this.createEmbeddedDocuments("Item", toCreate);
  }

  /* -------------------------------------------- */

  /**
   * Drop zero-valued lines so the chat card shows only what actually applied.
   * The base chance always shows, even at 0%, because a DF 10 skill genuinely
   * has an unskilled BCS of zero and hiding it would look like an error.
   *
   * @param {Array<{label: string, value: number, signed?: boolean}>} lines
   * @returns {Array<object>}
   */
  #breakdown(lines) {
    return lines
      .filter((line, index) => index === 0 || line.value !== 0)
      .map((line) => ({
        label: game.i18n.localize(line.label),
        value: line.signed && line.value >= 0 ? `+${line.value}` : `${line.value}`
      }));
  }
}
