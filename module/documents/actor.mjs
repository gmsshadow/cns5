import { CNS5 } from "../config.mjs";
import {
  clampSuccessChance,
  resolveCheck,
  checkToMessage,
  promptModifier
} from "../helpers/checks.mjs";
import {
  basicDefence,
  rollDefence,
  resolveExchange,
  promptDefence
} from "../helpers/defence-prompt.mjs";

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

  /**
   * Data available to roll formulae, including initiative.
   * @inheritDoc
   */
  getRollData() {
    const data = { ...super.getRollData() };
    data.initiative = this.system.actionPoints?.bonus ?? 0;
    data.bap = this.system.bap ?? 0;
    return data;
  }

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
      situational += prompted.modifier;
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
      situational += prompted.modifier;
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
    if (!skill && !weapon.system.natural) {
      // Name the skill that is missing, or say plainly that none is set. The
      // old message quoted an empty string, which read as nonsense.
      const wanted = weapon.system.resolvedSkill || weapon.system.skill;
      ui.notifications.warn(
        wanted
          ? game.i18n.format("CNS5.Weapon.noSkill", { weapon: weapon.name, skill: wanted })
          : game.i18n.format("CNS5.Weapon.noSkillSet", { weapon: weapon.name })
      );
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.weaponTitle", { weapon: weapon.name });

    // An attack is declared against somebody. The target is whoever this user
    // has targeted on the canvas, which is how Foundry expects it to be said.
    const target = [...game.user.targets][0]?.actor ?? null;
    const mode = game.settings.get("cns5", "defenceMode");

    let situational = modifier;
    let area = "none";
    if (!skipDialog) {
      const prompted = await promptModifier(title, { aimedShot: true });
      if (prompted === null) return null;
      situational += prompted.modifier;
      area = prompted.area;
    }

    // An aimed shot is an optional rule (p272), so it only applies when the
    // player picks a target area.
    const aimed = CNS5.aimedShotModifiers[area] ?? CNS5.aimedShotModifiers.none;
    situational += aimed.modifier;

    // The target declares how they are defending before the attack is rolled
    // (p270). Without a target there is nobody to ask.
    let declared = "none";
    let basic = null;
    if (target) {
      declared = await promptDefence(target, mode);
      if (declared === null) return null;

      // A passive defence is never rolled under either form of combat — that is
      // what makes it passive — so it comes off the attacker's chance whichever
      // mode is in use. Only an active defence changes with the mode.
      if (mode === "basic" || declared === "passive") {
        basic = basicDefence(target, declared);
        situational += basic.modifier;
      }
    }

    // A natural attack carries its own success chance and Difficulty Factor;
    // everything else reads them off the linked skill.
    const df = skill ? skill.system.df : weapon.system.naturalDf;
    const base = skill ? skill.system.tsc : weapon.system.naturalTsc;

    const unclamped = base + situational;
    const { target: chance, critMod, overflow, shortfall } = clampSuccessChance(unclamped, df);

    const result = await resolveCheck({
      target: chance,
      // The weapon's own Crit Die modifier stacks with any from the band.
      critMod: critMod + weapon.system.critDieModifier,
      failureCritMod: skill ? skill.system.failureCritMod : 0
    });
    result.attackerPsf = weapon.system.psf;

    // Advanced combat rolls the defence separately and reads the pair.
    const defence =
      target && mode === "advanced" && declared !== "none" && declared !== "passive"
        ? await rollDefence(target, declared, result)
        : null;
    const exchange = resolveExchange(result, defence);

    // Only a landed blow deals damage. The Crit Die always counts towards it on
    // a hit; what a critical adds on top is a separate d10 that ignores armour
    // and Fatigue alike (p272).
    const landed = exchange.damage;
    const blow = landed ? weapon.system.damage + result.critTotal : 0;

    // A critical met by an ordinary defence is "reduced to that of a normal
    // attack success" (p270) — the blow lands with its Crit Die and only the
    // extra die is lost.
    const criticalHit = landed && result.critical && !exchange.reduced;
    let bonusRoll = null;
    if (criticalHit) {
      bonusRoll = await new Roll(CNS5.criticalBonusDie).evaluate();
      result.rolls.push(bonusRoll);
    }

    const absorption = target?.system?.protection?.[weapon.system.damageType] ?? 0;
    const split = landed
      ? CNS5.applyDamage({
          damage: blow,
          bonus: bonusRoll?.total ?? 0,
          absorption,
          fatigue: target?.system?.fatigue?.value ?? 0
        })
      : null;

    // A failed attack whose Crit Die reached ten is a fumble: the attacker must
    // roll Agility to keep hold of the weapon, and the opponent gets a free
    // blow at -20% (p272).
    const fumble = !result.success && result.critical;

    // An active defence costs Fatigue whether it worked or not (p278, p284).
    // It is taken here rather than left on the card, because unlike damage it
    // is not conditional on anything and nobody would choose to skip it.
    const defenceFatigue = defence?.fatigueCost ?? basic?.fatigueCost ?? 0;
    if (target && defenceFatigue > 0) {
      if (target.isOwner) await target.spendFatigue(defenceFatigue);
      else {
        ui.notifications.info(
          game.i18n.format("CNS5.Defence.fatigueUnapplied", {
            name: target.name,
            fp: defenceFatigue
          })
        );
      }
    }

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format("CNS5.Roll.weaponSubtitle", {
        skill: skill ? skill.name : game.i18n.localize("CNS5.Weapon.natural"),
        target: chance
      }),
      targetName: target?.name ?? null,
      defence,
      exchange,
      exchangeLabel: game.i18n.localize(`CNS5.Exchange.${exchange.outcome}`),
      unclamped,
      overflow,
      shortfall,
      unskilled: skill ? !skill.system.known : false,
      damage: landed ? split.total : null,
      damageType: game.i18n.localize(`CNS5.DamageType.${weapon.system.damageType}`),
      split,
      blow,
      absorption,
      bonusDamage: bonusRoll?.total ?? 0,
      criticalHit,
      fumble,
      fumbleModifier: CNS5.opportuneAttackModifier,
      targetId: target?.uuid ?? null,
      defenceFatigue,
      targetArea: area === "none" ? null : game.i18n.localize(aimed.label),
      cost: game.i18n.format("CNS5.Roll.weaponCost", { ap: weapon.system.ap }),
      breakdown: this.#breakdown([
        {
          label: "CNS5.Roll.bcsSkilled",
          value: skill ? skill.system.bcs : CNS5.difficultyFactors[3].skilled
        },
        { label: "CNS5.Roll.psf", value: weapon.system.psf, signed: true },
        { label: "CNS5.Roll.aimedShot", value: aimed.modifier, signed: true },
        { label: "CNS5.Roll.defended", value: basic?.modifier ?? 0, signed: true },
        {
          label: "CNS5.Roll.situational",
          value: situational - aimed.modifier - (basic?.modifier ?? 0),
          signed: true
        },
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
      const wanted = spell.system.resolvedMode || spell.system.mode;
      ui.notifications.warn(
        wanted
          ? game.i18n.format("CNS5.Spell.noMode", { spell: spell.name, mode: wanted })
          : game.i18n.format("CNS5.Spell.noModeSet", { spell: spell.name })
      );
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.spellTitle", { spell: spell.name });
    const band = CNS5.spellRanges[range] ?? CNS5.spellRanges.short;

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted.modifier;
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

    // The Acts of Faith tables print no success chance, so compendium entries
    // ship with none. Rolling anyway would clamp to 1% and look like a working
    // roll that always fails.
    if (!act.system.successChance) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Faith.noChanceSet", { act: act.name })
      );
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.faithTitle", { act: act.name });

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted.modifier;
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
          // Promoted as Secondary Skills; "core" records where they came from
          // rather than how they advance (p119).
          category: "secondary",
          origin: "core",
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
   * Spend Fatigue Points, as an active defence does.
   *
   * @param {number} points
   * @returns {Promise<Actor>}
   */
  async spendFatigue(points) {
    if (!(points > 0)) return this;
    return this.update({
      "system.fatigue.value": Math.max(0, this.system.fatigue.value - points)
    });
  }

  /* -------------------------------------------- */

  /**
   * Take a blow.
   *
   * Fatigue absorbs what gets past the armour until it is gone, and Body takes
   * the rest. A critical's bonus die comes straight off Body whatever remains
   * of either.
   *
   * @param {object} split  the result of CNS5.applyDamage
   * @returns {Promise<Actor>}
   */
  async applyDamage(split) {
    if (!split) return this;

    return this.update({
      "system.fatigue.value": Math.max(0, this.system.fatigue.value - split.fatigueLost),
      // Body is allowed below zero: a character is unconscious at nought and
      // dead at negative Constitution (p282).
      "system.body.value": this.system.body.value - split.bodyLost
    });
  }

  /* -------------------------------------------- */

  /**
   * Add the Accurate Counting competency, which every character of Intellect
   * 12 or better possesses (creation worksheet, Vocation and Skills).
   *
   * @returns {Promise<Item[]>}
   */
  async addAccurateCounting() {
    const has = this.items.some(
      (i) => i.type === "skill" && i.name.toLowerCase() === "accurate counting"
    );
    if (has) return [];

    return this.createEmbeddedDocuments("Item", [
      {
        name: "Accurate Counting",
        type: "skill",
        system: {
          df: 1,
          attributes: [],
          kind: "competency",
          category: "secondary",
          origin: "core",
          known: true,
          level: 1
        }
      }
    ]);
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
