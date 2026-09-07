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
   * Attack with a weapon.
   *
   * The success chance is the linked combat skill's, so this is a skill check
   * with the weapon's own Crit Die modifier folded in. Damage is reported
   * alongside: base plus Strength bonus plus Attacker's Bonus, with the
   * adjusted Crit Die added on a hit (p281).
   *
   * @param {string} itemId
   * @param {object} [options]
   * @returns {Promise<ChatMessage|null>}
   */
  async rollWeapon(itemId, { modifier = 0, skipDialog = false } = {}) {
    const weapon = this.items.get(itemId);
    if (!weapon || weapon.type !== "weapon") {
      throw new Error(`CnS5 | No weapon item ${itemId} on ${this.name}`);
    }

    const skill = weapon.system.skillItem;
    if (!skill) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Weapon.noSkill", { weapon: weapon.name, skill: weapon.system.skill })
      );
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.weaponTitle", { weapon: weapon.name });

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted;
    }

    const unclamped = skill.system.tsc + situational;
    const { target, critMod, overflow, shortfall } = clampSuccessChance(unclamped, skill.system.df);

    const result = await resolveCheck({
      target,
      // The weapon's own Crit Die modifier stacks with any from the band.
      critMod: critMod + weapon.system.critDieModifier,
      failureCritMod: skill.system.failureCritMod
    });

    // Only a hit deals damage, and the adjusted Crit Die is part of it.
    const damage = result.success ? weapon.system.damage + result.critTotal : 0;

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format("CNS5.Roll.weaponSubtitle", {
        skill: skill.name,
        target
      }),
      unclamped,
      overflow,
      shortfall,
      unskilled: !skill.system.known,
      damage: result.success ? damage : null,
      damageType: game.i18n.localize(`CNS5.DamageType.${weapon.system.damageType}`),
      breakdown: this.#breakdown([
        { label: "CNS5.Roll.bcsSkilled", value: skill.system.bcs },
        { label: "CNS5.Roll.psf", value: skill.system.psf, signed: true },
        { label: "CNS5.Roll.situational", value: situational, signed: true },
        { label: "CNS5.Weapon.baseDamage", value: weapon.system.baseDamage },
        { label: "CNS5.Weapon.strengthBonus", value: weapon.system.strengthBonus, signed: true },
        { label: "CNS5.Weapon.attackerBonus", value: weapon.system.attackerBonus, signed: true }
      ])
    });
  }

  /* -------------------------------------------- */

  /**
   * Cast a spell at one of its three range bands.
   *
   * @param {string} itemId
   * @param {string} [range]  short, long or max
   * @returns {Promise<ChatMessage|null>}
   */
  async rollSpell(itemId, range = "short", { modifier = 0, skipDialog = false } = {}) {
    const spell = this.items.get(itemId);
    if (!spell || spell.type !== "spell") {
      throw new Error(`CnS5 | No spell item ${itemId} on ${this.name}`);
    }

    const mode = spell.system.modeItem;
    if (!mode) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Spell.noMode", { spell: spell.name, mode: spell.system.mode })
      );
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.spellTitle", { spell: spell.name });
    const band = CNS5.spellRanges[range] ?? CNS5.spellRanges.short;

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted;
    }

    const unclamped =
      mode.system.tsc + band.modifier + spell.system.otherModifier + situational;
    const { target, critMod, overflow, shortfall } = clampSuccessChance(unclamped, mode.system.df);

    const result = await resolveCheck({ target, critMod });

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format("CNS5.Roll.spellSubtitle", {
        range: game.i18n.localize(band.label),
        target
      }),
      unclamped,
      overflow,
      shortfall,
      cost: game.i18n.format("CNS5.Roll.spellCost", {
        fp: spell.system.fpToCast,
        ap: spell.system.apToCast
      }),
      breakdown: this.#breakdown([
        { label: "CNS5.Roll.bcsSkilled", value: mode.system.bcs },
        { label: "CNS5.Roll.psf", value: mode.system.psf, signed: true },
        { label: "CNS5.Roll.rangeBand", value: band.modifier, signed: true },
        { label: "CNS5.Spell.otherModifier", value: spell.system.otherModifier, signed: true },
        { label: "CNS5.Roll.situational", value: situational, signed: true }
      ])
    });
  }

  /* -------------------------------------------- */

  /**
   * Attempt an Act of Faith.
   *
   * An Act of Faith has a flat success chance rather than a Difficulty Factor,
   * so there is no Min%/Max% band to clamp against — only the Crit Die is read
   * for magnitude.
   *
   * @param {string} itemId
   * @returns {Promise<ChatMessage|null>}
   */
  async rollActOfFaith(itemId, { modifier = 0, skipDialog = false } = {}) {
    const act = this.items.get(itemId);
    if (!act || act.type !== "actOfFaith") {
      throw new Error(`CnS5 | No Act of Faith item ${itemId} on ${this.name}`);
    }

    if (!act.system.available) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Faith.tooLowPff", {
          act: act.name,
          minimum: act.system.pffMinimum
        })
      );
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.faithTitle", { act: act.name });

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted;
    }

    const target = Math.clamp(act.system.successChance + situational, 1, 100);
    const result = await resolveCheck({ target });

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format("CNS5.Roll.faithSubtitle", { target }),
      cost: game.i18n.format("CNS5.Roll.faithCost", {
        fp: act.system.fpCost,
        ap: act.system.apToPray
      }),
      breakdown: this.#breakdown([
        { label: "CNS5.Faith.successChance", value: act.system.successChance },
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
