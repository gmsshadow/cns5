import { CNS5 } from "../config.mjs";
import {
  clampSuccessChance,
  resolveCheck,
  checkToMessage,
  promptModifier
} from "../helpers/checks.mjs";
import { styleDie } from "../helpers/dice.mjs";
import {
  basicDefence,
  rollDefence,
  resolveExchange,
  promptDefence
} from "../helpers/defence-prompt.mjs";
import { armourAt } from "../helpers/defence.mjs";
import { parseMagnitude } from "../helpers/magnitude.mjs";
import { parseFaithChance, parseFaithCost, faithChanceFor } from "../helpers/faith.mjs";
import {
  promptShot,
  promptThrow,
  promptTargeting,
  promptMethod
} from "../helpers/defence-prompt.mjs";
import {
  magickTables,
  intrinsicResistance,
  resolveTargeting,
  magickalDefences
} from "../helpers/targeting.mjs";
import {
  missileProfile,
  availableAmmunition,
  resolveShot,
  missileData
} from "../helpers/missiles.mjs";

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
   * Set a new actor's token up sensibly.
   *
   * Body and Fatigue are what a token wants to show, so they are chosen here
   * rather than through the system manifest's legacy keys. Those set the bars
   * invisibly: the token configuration showed nothing chosen while the bars
   * filled anyway, which is impossible to correct because there is nothing on
   * screen to correct.
   *
   * @inheritDoc
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    // Only where the creator has expressed no preference of their own.
    if (data.prototypeToken?.bar1 || data.prototypeToken?.bar2) return;

    this.updateSource({
      prototypeToken: {
        bar1: { attribute: "body" },
        bar2: { attribute: "fatigue" },
        displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
        displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
        actorLink: this.type === "character"
      }
    });
  }

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
      // A test of strength between two characters is settled by the lower
      // Absolute Strength Rating where both succeed (p106), so it is reported
      // on the card for a Strength roll rather than left to be looked up.
      asr: attribute === "str" ? this.system.asr : null,
      breakdown: this.#breakdown([
        { label: "CNS5.Roll.baseAr", value: attr.ar - (attr.asrBonus ?? 0) },
        { label: "CNS5.Roll.asrBonus", value: attr.asrBonus ?? 0, signed: true },
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


    const title = game.i18n.format("CNS5.Roll.weaponTitle", { weapon: weapon.name });

    // A shot is a bow and an arrow together, at a distance. None of the three
    // figures that matter — damage, reach, Crit Die modifier — can be read off
    // the bow alone, so the loading and the range are settled before anything
    // else (pp.257-258).
    // A weapon in the hand may be thrown if the ranges table gives it a
    // profile. That is asked rather than assumed: a War Axe is a weapon to
    // swing that can also be hurled, and owning only half of it was the fault
    // of treating "thrown" as a kind of weapon.
    const thrownProfile =
      weapon.system.role === "melee" ? await missileProfile(weapon, null) : null;
    const canThrow = Boolean(thrownProfile?.thrown);

    let throwing = false;
    if (canThrow && !skipDialog) {
      const choice = await promptThrow(weapon, thrownProfile);
      if (choice === null) return null;
      throwing = choice === "throw";
    }

    // Which skill applies depends on what the character is doing. A War Axe is
    // swung with Axes and hurled with Hurling Axes — different Difficulty
    // Factors, different attributes, and a prerequisite relationship between
    // them — so the skill cannot be settled until the choice is made.
    const hurlingName = throwing ? CNS5.hurlingSkillFor(weapon.name) : "";
    const skill = throwing
      ? this.items.find(
          (i) => i.type === "skill" && i.name.toLowerCase() === hurlingName.toLowerCase()
        ) ?? null
      : weapon.system.skillItem;

    if (!skill && !weapon.system.natural) {
      const wanted = throwing
        ? hurlingName
        : weapon.system.resolvedSkill || weapon.system.skill;
      ui.notifications.warn(
        wanted
          ? game.i18n.format("CNS5.Weapon.noSkill", { weapon: weapon.name, skill: wanted })
          : game.i18n.format("CNS5.Weapon.noSkillSet", { weapon: weapon.name })
      );
      return null;
    }

    const shoots = weapon.system.role === "launcher" || throwing;
    let shot = null;
    let ammunition = null;

    if (shoots && !skipDialog) {
      const loadings = [];
      // A thrown weapon is its own ammunition, so there is nothing to choose.
      if (throwing && thrownProfile) loadings.push({ item: null, profile: thrownProfile });
      else if (weapon.system.role === "launcher") {
        for (const item of availableAmmunition(this, weapon)) {
          const profile = await missileProfile(weapon, item);
          if (profile) loadings.push({ item, profile });
        }
      }
      // Nothing carried that this launcher takes. The shot is still allowed —
      // refusing it would punish anyone not tracking arrows — but the loading
      // is named as an assumption rather than passed off as a choice.
      if (!loadings.length) {
        const profile = await missileProfile(weapon, null);
        if (profile) loadings.push({ item: null, profile, assumed: true });
      }

      const missiles = await missileData();

      if (!loadings.length) {
        ui.notifications.warn(
          game.i18n.format("CNS5.Missile.noProfile", { weapon: weapon.name })
        );
      } else {
        const chosen = await promptShot(weapon, loadings, this.system, missiles.rangePenalties);
        if (chosen === null) return null;

        const loading = loadings[chosen.loading] ?? loadings[0];
        ammunition = loading.item;
        shot = resolveShot({
          profile: loading.profile,
          band: chosen.band,
          strength: this.system.attr.str.value,
          ammunition: ammunition?.name ?? loading.profile.ammunition,
          // The head does the work. A bow's own Crit Die modifier is nothing in
          // every row of the table; the arrow's is what tells, and dropping it
          // lost every missile between one and two on the die.
          ammunitionCrit: ammunition?.system.critDieModifier ?? 0,
          strengthModifiers: missiles.strengthModifiers,
          rangePenalties: missiles.rangePenalties
        });
      }
    }

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

    // Distance costs a shot its chance as well as its Crit Die (p258).
    situational += shot?.tscModifier ?? 0;

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

    // A shot's Crit Die modifiers are gathered by the shot itself, the
    // ammunition's among them, so the launcher's is not added twice.
    const weaponCrit = shot ? shot.critMod : weapon.system.critDieModifier;

    const result = await resolveCheck({
      target: chance,
      // The weapon's own Crit Die modifier stacks with any from the band.
      critMod: critMod + weaponCrit,
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
    // Each modifier is shown with the sign it was applied with, which on a
    // failed roll is the opposite of the sign it was written with (p37).
    const critSign = result.critSign;

    const landed = exchange.damage;
    // A shot's damage is the pairing's, not the bow's: the table has already
    // added the arrow to it.
    const weaponDamage = shot ? shot.baseDamage : weapon.system.damage;
    const blow = landed ? weaponDamage + result.critTotal : 0;

    // A critical met by an ordinary defence is "reduced to that of a normal
    // attack success" (p270) — the blow lands with its Crit Die and only the
    // extra die is lost.
    const criticalHit = landed && result.critical && !exchange.reduced;
    let bonusRoll = null;
    if (criticalHit) {
      bonusRoll = styleDie(await new Roll(CNS5.criticalBonusDie).evaluate(), "bonus");
      result.rolls.push(bonusRoll);
    }

    // An unaimed blow strikes the chest. Where a target area was named, it is
    // the armour over that part which stops it — and whether a given piece
    // reaches that far is a question in its own right, since a hauberk covers
    // the knee only seven times in ten.
    // The aimed shot table treats an arm as one thing while armour is fitted to
    // it in two pieces, so where the named area is divided a die settles which
    // part the blow found.
    let struck = area === "none" ? "chest" : area;
    let subdivisionRoll = null;
    if (CNS5.areaSubdivisions[struck]) {
      subdivisionRoll = await new Roll(CNS5.areaSubdivisions[struck].die).evaluate();
      struck = CNS5.subdivideArea(struck, subdivisionRoll.total);
    }

    const worn = target
      ? await armourAt(target, struck, weapon.system.damageType)
      : { absorption: 0, pieces: [], missed: [] };
    const absorption = worn.absorption;
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
    // A missile loosed is a missile gone.
    if (ammunition && ammunition.system.quantity > 0) {
      await ammunition.update({ "system.quantity": ammunition.system.quantity - 1 });
    }

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
      // A basic or passive defence is never rolled, so it has nothing to show
      // in the defence line unless it is reported separately.
      passiveDefence: basic && basic.modifier !== 0 ? basic : null,
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
      shot,
      weaponCrit,
      shotLabel: shot
        ? game.i18n.format("CNS5.Missile.shotAt", {
            ammunition: ammunition?.name ?? shot.strengthRow,
            band: game.i18n.localize(`CNS5.Range.${shot.band}`),
            reach: shot.reach
          })
        : null,
      hitLocation: struck,
      hitLocationLabel: game.i18n.localize(`CNS5.TargetArea.${struck}`),
      subdivisionRoll: subdivisionRoll?.total ?? null,
      armourPieces: worn.pieces.map((p) => p.name),
      // A piece that covers the part only partly and did not meet the blow is
      // worth naming: it explains an absorption lower than the sheet suggests.
      armourMissed: worn.missed.map((p) => `${p.name} (${p.roll} > ${p.chance})`),
      bonusDamage: bonusRoll?.total ?? 0,
      criticalHit,
      fumble,
      fumbleModifier: CNS5.opportuneAttackModifier,
      targetId: target?.uuid ?? null,
      defenceFatigue,
      targetArea: area === "none" ? null : game.i18n.localize(aimed.label),
      cost: game.i18n.format("CNS5.Roll.weaponCost", { ap: weapon.system.ap }),
      // The Crit Die's own workings, which are easy to lose sight of: three
      // things modify it on a shot and only one on a blow.
      //
      // Every modifier is shown as it was *applied*, not as it was written.
      // A favourable modifier increases the Crit Die of a successful roll and
      // reduces that of a failed one (p37) — so a +5 takes a failure from 8 to
      // 3. Printing it as "+5" beside a die that went down reads as a fault,
      // and this card said exactly that.
      critBreakdown: this.#breakdown([
        { label: "CNS5.Roll.critDieRolled", value: result.critRaw },
        {
          label: shot ? "CNS5.Roll.critFromMissile" : "CNS5.Roll.critFromWeapon",
          value: (shot ? shot.ammunitionCrit : weapon.system.critDieModifier) * critSign,
          signed: true
        },
        { label: "CNS5.Roll.critFromRange", value: (shot?.rangeCrit ?? 0) * critSign, signed: true },
        {
          label: "CNS5.Roll.critFromStrength",
          value: (shot?.strengthCrit ?? 0) * critSign,
          signed: true
        },
        { label: "CNS5.Roll.critFromBand", value: critMod * critSign, signed: true }
      ]),
      critNote: result.success ? null : "CNS5.Roll.critOnFailure",
      breakdown: this.#breakdown([
        {
          label: "CNS5.Roll.bcsSkilled",
          value: skill ? skill.system.bcs : CNS5.difficultyFactors[3].skilled
        },
        { label: "CNS5.Roll.psf", value: weapon.system.psf, signed: true },
        { label: "CNS5.Roll.aimedShot", value: aimed.modifier, signed: true },
        { label: "CNS5.Roll.rangePenalty", value: shot?.tscModifier ?? 0, signed: true },
        { label: "CNS5.Roll.defended", value: basic?.modifier ?? 0, signed: true },
        {
          label: "CNS5.Roll.situational",
          value:
            situational - aimed.modifier - (basic?.modifier ?? 0) - (shot?.tscModifier ?? 0),
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
  async rollSpell(
    itemId,
    range = "short",
    { modifier = 0, skipDialog = false, fromBook = false } = {}
  ) {
    const spell = this.items.get(itemId);
    if (!spell || spell.type !== "spell") {
      throw new Error(`CnS5 | No spell item ${itemId} on ${this.name}`);
    }

    // Where the spell's group settles no Method and the caster knows several,
    // the choice is theirs. Asking is the only honest answer: picking the best
    // one would decide a matter the rules leave to the caster.
    // Read by its right name: a Method is the school, not the tradition.
    let method = spell.system.methodItem;
    if (!method && spell.system.methodChoices?.length > 1 && !skipDialog) {
      const chosen = await promptMethod(spell, spell.system.methodChoices);
      if (chosen === null) return null;
      method = this.items.find(
        (i) => i.type === "skill" && i.name.toLowerCase() === chosen.toLowerCase()
      );
    }

    if (!method) {
      const wanted = spell.system.resolvedMethod || spell.system.method;
      ui.notifications.warn(
        wanted
          ? game.i18n.format("CNS5.Spell.noMethod", { spell: spell.name, method: wanted })
          : game.i18n.format("CNS5.Spell.noMethodSet", { spell: spell.name })
      );
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.spellTitle", { spell: spell.name });

    // Casting a spell and targeting it are separate acts (p296). The roll made
    // here is the targeting one: everything between the caster and the target
    // bears on it, and none of it bears on the casting.
    const tables = await magickTables();
    const target = [...game.user.targets][0]?.actor ?? null;
    const resistance = intrinsicResistance(target, tables.targetResistance);

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted.modifier;
    }

    let declared = {
      mana: "average",
      source: "memory",
      range,
      dodgePsf: 0,
      resistance: null,
      willing: false,
      extendRange: false,
      movement: [],
      obstacles: [],
      situational: 0
    };

    // A Focus serves only the mage attuned to it, so only one this caster made
    // and is carrying is offered. Left blank, "attuned to" is taken to mean the
    // bearer — the usual case, since a Focus is made for oneself.
    const focus = this.items.find(
      (i) =>
        i.type === "magickalItem" &&
        i.system.kind === "focus" &&
        i.system.carried &&
        (!i.system.attunedTo || i.system.attunedTo === this.name)
    ) ?? null;

    if (!skipDialog) {
      const answered = await promptTargeting(spell, {
        tables,
        resistance,
        targetName: target?.name ?? null,
        focus,
        fromBook
      });
      if (answered === null) return null;
      declared = answered;
    }

    const throughFocus = declared.useFocus && focus ? focus : null;
    const focusGrade = throughFocus ? CNS5.focusGrades[throughFocus.system.grade] : null;

    // Read from his own book, a spell costs as one read from any book does:
    // half (p297).
    const source = fromBook ? "book" : declared.source;
    const cost = CNS5.spellCost({
      // The caster's own cost, with anything his tradition carries past MR 10
      // added at 3 FP a point (p294).
      base: spell.system.effectiveFp,
      mana: declared.mana,
      source,
      extendRange: declared.extendRange,
      focus: throughFocus?.system.grade ?? null
    });

    /* -- Casting a spell not yet fully learnt (p299) ------------------------ */

    // A known spell comes to hand without a roll. One still being learnt has
    // to be got into shape first, at 10% off for every point of Magick
    // Resistance still to go — unless it is read from the mage's own book,
    // which casts it "as if he had learnt it fully", at twice the time (p307).
    let castingStep = null;
    if (spell.system.partlyLearnt && !fromBook) {
      const need = Math.max(0, method.system.tsc + spell.system.learningPenalty);
      const { target: clamped, critMod: castCrit } = clampSuccessChance(need, method.system.df);
      const cast = await resolveCheck({ target: clamped, critMod: castCrit });

      castingStep = {
        heading: game.i18n.localize("CNS5.Step.casting"),
        text: game.i18n.format("CNS5.Step.partlyLearnt", {
          remaining: spell.system.remaining,
          penalty: spell.system.learningPenalty
        }),
        rolled: true,
        roll: cast.roll,
        need: clamped,
        success: cast.success,
        outcome: game.i18n.localize(cast.success ? "CNS5.Step.cast" : "CNS5.Step.notCast")
      };

      if (!cast.success) {
        // The Crit Die of the failed casting says how badly it went, and every
        // result costs Fatigue at its own multiple (p299).
        const backfire = CNS5.readBackfire(cast.critTotal);
        const fatigue = Math.ceil(cost.fatigue * backfire.fatigue);
        await this.spendMagickCost(fatigue);

        return checkToMessage(this, {
          ...cast,
          title,
          subtitle: game.i18n.format("CNS5.Backfire.subtitle", { need: clamped }),
          targetingHeading: castingStep.heading,
          nothingToTarget: game.i18n.localize(`CNS5.Backfire.${backfire.key}`),
          backfire,
          backfireLabel: game.i18n.format("CNS5.Backfire.label", {
            die: cast.critTotal,
            severity: game.i18n.localize(`CNS5.Backfire.name.${backfire.key}`)
          }),
          cost: game.i18n.format("CNS5.Backfire.costs", {
            fp: fatigue,
            base: cost.fatigue,
            multiple: backfire.fatigue
          })
        });
      }

      // Carried onto the targeting card, so both sets of dice are accounted for.
      castingStep.rolls = cast.rolls;
    } else if (fromBook) {
      castingStep = {
        heading: game.i18n.localize("CNS5.Step.casting"),
        text: game.i18n.localize("CNS5.Step.fromBook"),
        rolled: false,
        success: true,
        outcome: game.i18n.localize("CNS5.Step.cast")
      };
    }

    const targeting = resolveTargeting({
      methodTsc: method.system.tsc,
      resistance: declared.resistance ?? resistance.value,
      range: declared.range,
      movement: declared.movement,
      obstacles: declared.obstacles,
      willing: declared.willing,
      dodgePsf: declared.dodgePsf,
      manaBonus: cost.tscBonus,
      // A Focus sharpens the caster's skill in the school and his aim alike.
      focusBonus: focusGrade ? focusGrade.psf + focusGrade.targeting : 0,
      // Days of meditation stored up in this one spell (p298).
      meditationBonus: CNS5.targetingMeditationBonus({
        days: declared.meditationTargeting ?? 0,
        fasting: declared.meditationFasting ?? false,
        magickLevel: this.system.magick.level
      }),
      situational: situational + declared.situational + spell.system.otherModifier,
      tables
    });

    // True Lead is not a penalty but a wall: "No penetration". Rolling against
    // a very small number would say "unlikely" where the rules say "never".
    if (targeting.impenetrable) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Targeting.blocked", { obstacle: targeting.impenetrableBy })
      );
      return null;
    }

    const unclamped = targeting.total;
    const { target: chance, critMod, overflow, shortfall } = clampSuccessChance(
      unclamped,
      method.system.df
    );

    // Whatever protects the target is targeted first, outermost in (p298).
    const pierced = await this.#pierceDefences({
      target,
      targeting,
      difficulty: method.system.df
    });

    if (!pierced.through) {
      return checkToMessage(this, {
        ...(await resolveCheck({ target: chance, critMod })),
        rolls: [...(castingStep?.rolls ?? []), ...pierced.rolls],
        title,
        subtitle: game.i18n.format("CNS5.Roll.spellSubtitle", {
          range: game.i18n.localize(CNS5.spellRanges[declared.range].label),
          target: chance
        }),
        castingStep,
        defenceSteps: pierced.steps,
        nothingToTarget: game.i18n.format("CNS5.Defence.blocked", {
          name: pierced.stoppedBy.name
        }),
        cost: game.i18n.format("CNS5.Roll.spellCost", {
          fp: cost.fatigue,
          ap: spell.system.apToCast
        })
      });
    }

    const result = await resolveCheck({ target: chance, critMod });
    if (castingStep?.rolls) result.rolls.unshift(...castingStep.rolls);
    if (pierced.rolls.length) result.rolls.unshift(...pierced.rolls);

    // Tapping the Metaphysical Current costs Fatigue, "or if exhausted, Body
    // Points" (p296) — whether or not the targeting found its mark.
    await this.spendMagickCost(cost.fatigue);

    // A spell that reaches its target may still be thrown off by them, where
    // the spell is one that works on the mind (p300). The caster's skill in the
    // school is what the target contends against.
    // Named a save rather than a resistance: the target's *Magick Resistance*
    // is a different thing entirely, and it has already been subtracted above.
    let save = null;
    if (result.success && target && spell.system.resistable) {
      save = await target.resistSpell({
        // The Focus adds to the caster's skill in the school, and that is what
        // the target contends against.
        casterPsf: method.system.psf + (focusGrade?.psf ?? 0),
        presence: Math.max(
          this.system.attr.app?.value ?? 0,
          this.system.attr.bv?.value ?? 0
        ),
        reductions: declared.saveReductions ?? {}
      });
      if (save) result.rolls.push(...save.rolls);
    }

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format("CNS5.Roll.spellSubtitle", {
        range: game.i18n.localize(CNS5.spellRanges[declared.range].label),
        target: chance
      }),
      unclamped,
      overflow,
      shortfall,
      targetName: target?.name ?? null,
      cost: game.i18n.format("CNS5.Roll.spellCost", {
        fp: cost.fatigue,
        ap: spell.system.apToCast
      }),
      spellCost: cost,
      // "Once the time limit is reached, the spell degrades over a 1D10 minute
      // period" (p296) — so a spell does not stop dead, and the die is rolled
      // where there is a duration to run out.
      durationLabel: spell.system.durationLabel,
      decayMinutes: result.success && spell.system.parsedDuration?.kind === "formula"
        ? (await new Roll(CNS5.spellDecayDie).evaluate()).total
        : null,
      // Only a spell that needed getting into shape, or was read from a book,
      // has a step before the targeting to show.
      castingStep,
      defenceSteps: pierced.steps,
      targetingHeading:
        castingStep || pierced.steps.length ? game.i18n.localize("CNS5.Step.targeting") : null,
      saveHeading: castingStep ? game.i18n.localize("CNS5.Step.save") : null,
      // "This doubles the time required to cast the spell" (p307).
      bookNote: fromBook ? game.i18n.localize("CNS5.Book.doubleTime") : null,
      save,
      saveLabel: save
        ? game.i18n.format(save.resisted ? "CNS5.Save.resisted" : "CNS5.Save.failed", {
            name: target.name,
            roll: save.roll,
            chance: save.chance
          })
        : null,
      saveCertain: save?.certain ? game.i18n.localize(`CNS5.Save.${save.certain}`) : null,
      offersSave: Boolean(target && spell.system.resistable),
      breakdown: this.#breakdown([
        { label: "CNS5.Roll.bcsSkilled", value: method.system.bcs },
        { label: "CNS5.Roll.psf", value: method.system.psf, signed: true },
        { label: "CNS5.Targeting.resistance", value: -targeting.resistance, signed: true },
        { label: "CNS5.Roll.rangeBand", value: targeting.rangeModifier, signed: true },
        { label: "CNS5.Targeting.movement", value: targeting.movementTotal, signed: true },
        { label: "CNS5.Targeting.obstacles", value: targeting.obstacleTotal, signed: true },
        { label: "CNS5.Targeting.willingShort", value: targeting.willingBonus, signed: true },
        { label: "CNS5.Targeting.dodge", value: -targeting.dodgePsf, signed: true },
        { label: "CNS5.Mana.bonus", value: targeting.manaBonus, signed: true },
        { label: "CNS5.Focus.bonus", value: targeting.focusBonus, signed: true },
        { label: "CNS5.Targeting.meditation", value: targeting.meditationBonus, signed: true },
        { label: "CNS5.Roll.situational", value: targeting.situational, signed: true }
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

    // "† Acts of Faith that are solely within the competence of ordained
    // priests. ‡ Acts... that may only be invoked by ordained Priests,
    // Monastics and members of Holy Fighting Orders" (p404).
    const standing = this.system.details.holyStanding ?? "lay";
    if (act.system.ordainedOnly && standing !== "ordained") {
      ui.notifications.warn(game.i18n.format("CNS5.Faith.ordainedOnly", { act: act.name }));
      return null;
    }
    if (act.system.monasticOnly && standing === "lay") {
      ui.notifications.warn(game.i18n.format("CNS5.Faith.monasticOnly", { act: act.name }));
      return null;
    }

    const title = game.i18n.format("CNS5.Roll.faithTitle", { act: act.name });

    // The Act may name a recipient other than the one praying, and its chance
    // and its cost may fall on either (p404).
    const recipient = [...game.user.targets][0]?.actor ?? null;
    const people = { performer: this, recipient };

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted.modifier;
    }

    /* -- The Sacraments, which need no roll -------------------------------- */

    // "Auto: Automatically takes effect (i.e. no Spirit AR% roll, etc. is
    // required)."
    if (act.system.automatic) {
      const spent = await this.#payFaithCost(act, people, null);
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        content: `<div class="cns5-check">
          <h3 class="cns5-check__title">${title}</h3>
          <p class="cns5-check__result">${game.i18n.localize("CNS5.Faith.automatic")}</p>
          ${spent.label ? `<p class="cns5-check__cost">${spent.label}</p>` : ""}
        </div>`
      });
    }

    const { variants, unread } = parseFaithChance(act.system.successChanceText);
    if (!variants.length) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Faith.noChanceSet", { act: act.name, text: unread ?? "" })
      );
      return null;
    }

    // Where the book gives alternatives, the first is taken; a Gamemaster who
    // wants the other can roll it as a free-form check.
    const steps = variants[0];

    // "Table - Requests for Divine Aid shows who a character is able to pray
    // for." A layman prays for himself alone; only from True Believer upwards
    // may another be named at all.
    const aid = this.system.faith.divineAid;
    const others = [...game.user.targets].filter((t) => t.actor !== this).length;
    if (others > Math.max(aid.others, aid.instead ? 1 : 0)) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Faith.tooManyPrayedFor", {
          asked: others,
          allowed: aid.others,
          believer: game.i18n.localize(`CNS5.Believer.${this.system.faith.believer}`)
        })
      );
      return null;
    }

    // A step against the recipient needs a recipient.
    if (!recipient && steps.some((step) => step.of === "recipient" ||
        (step.added ?? []).some((a) => a.of === "recipient"))) {
      ui.notifications.warn(game.i18n.format("CNS5.Faith.needsRecipient", { act: act.name }));
      return null;
    }

    /* -- Each step in turn, all of which must succeed ---------------------- */

    const rolls = [];
    const faithSteps = [];
    let last = null;
    let succeeded = true;

    for (const [index, step] of steps.entries()) {
      const { chance, parts } = faithChanceFor(step, people);
      const need = Math.clamp(chance + (index === 0 ? situational : 0), 1, 100);
      const roll = await resolveCheck({ target: need });
      rolls.push(...roll.rolls);
      last = roll;

      faithSteps.push({
        heading: game.i18n.format("CNS5.Faith.step", { number: index + 1 }),
        text: parts.map((p) => `${p.label} (${p.value})`).join(" + "),
        rolled: true,
        roll: roll.roll,
        need,
        success: roll.success,
        outcome: game.i18n.localize(roll.success ? "CNS5.Faith.granted" : "CNS5.Faith.denied")
      });

      if (!roll.success) {
        succeeded = false;
        break;
      }
    }

    const spent = await this.#payFaithCost(act, people, last);
    const spirit = await this.#settleSpirit(spent.fatigue, succeeded, last?.critTotal ?? 0);

    return checkToMessage(this, {
      ...last,
      rolls,
      title,
      subtitle: game.i18n.format("CNS5.Faith.subtitle", {
        chance: act.system.successChanceText
      }),
      defenceSteps: faithSteps.slice(0, -1),
      targetingHeading: faithSteps.length > 1 ? faithSteps.at(-1).heading : null,
      targetName: recipient?.name ?? null,
      cost: spent.label,
      spiritNote: spirit?.label ?? null,
      nothingToTarget: succeeded ? null : game.i18n.localize("CNS5.Faith.notGranted"),
      breakdown: this.#breakdown([
        ...faithChanceFor(steps[0], people).parts.map((p) => ({ label: p.label, value: p.value })),
        { label: "CNS5.Roll.situational", value: situational, signed: true }
      ])
    });
  }

  /* -------------------------------------------- */

  /**
   * What witnessing a miracle does to a character's Spirit (p401).
   *
   * A believer of the faith gains outright. A man of another religion gains
   * belief in the faith he has just seen at work and loses it in his own —
   * and since a character keeps one Current Spirit rather than one per
   * religion, the loss is applied and the gain reported for the Gamemaster to
   * record against the new faith.
   *
   * @param {object} options
   * @returns {Promise<object>}
   */
  async witnessMiracle({ level = "minor", role = "witness", sameFaith = true, critical = false }) {
    const change = CNS5.miracleSpirit({ level, role, sameFaith, critical });

    if (change.own) {
      await this.update({ "system.spirit.value": this.system.spirit.value + change.own });
    }

    return { ...change, name: this.name };
  }

  /* -------------------------------------------- */

  /**
   * Draw the Belief Pool from a congregation at worship (p403).
   *
   * "Acts of Faith which are performed for a congregation or for a community
   * of believers can call upon the Belief of those participating." The pool is
   * rolled from the size of the congregation, the building and any shrine, and
   * what is drawn stands until it is spent.
   *
   * @returns {Promise<ChatMessage|null>}
   */
  async drawBeliefPool() {
    const { multiplier, formula, parts } = this.system.faith.beliefPoolFormula;
    if (!multiplier) {
      ui.notifications.warn(game.i18n.localize("CNS5.Belief.noCongregation"));
      return null;
    }

    const roll = await new Roll(formula).evaluate();
    await this.update({ "system.faith.beliefPool": roll.total });

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      rolls: [roll],
      content: `<div class="cns5-check">
        <h3 class="cns5-check__title">${game.i18n.localize("CNS5.Belief.drawn")}</h3>
        <p class="cns5-check__result">${game.i18n.format("CNS5.Belief.pool", {
          total: roll.total,
          multiplier
        })}</p>
        <p class="cns5-hint">${parts
          .map((part) => `${game.i18n.localize(part.label)} (${part.multiplier})`)
          .join(", ")}</p>
      </div>`
    });
  }

  /* -------------------------------------------- */

  /**
   * What performing an Act of Faith does to the intercessor's Spirit (p400).
   *
   * He expends Current Spirit equal to the Act's Fatigue cost. Granted, he has
   * it all back, and one more if the Crit Die came up ten. Denied, he has only
   * half of it back — "he believes his Deity may have forsaken him" — and on a
   * critical failure none at all.
   *
   * @param {number} cost
   * @param {boolean} success
   * @param {number} critTotal
   * @returns {Promise<{label: string}|null>}
   */
  async #settleSpirit(cost, success, critTotal) {
    if (!(cost > 0)) return null;

    const change = CNS5.spiritAfterAct({ cost, success, critTotal });
    if (change.net !== 0) {
      // Not floored at nothing. Current Spirit "can lapse into total
      // non-existence" (p400) and further: p404 speaks of "those with low or
      // negative Spirit", whom evil spirits are drawn to, and gives them a
      // negative aura. A man may believe less than nothing.
      await this.update({
        "system.spirit.value": this.system.spirit.value + change.net
      });
    }

    return {
      label: game.i18n.format(`CNS5.Spirit.${change.key}`, {
        expended: change.expended,
        regained: change.regained,
        net: change.net > 0 ? `+${change.net}` : change.net
      })
    };
  }

  /* -------------------------------------------- */

  /**
   * Take what an Act of Faith costs, from whoever it names.
   *
   * "Cost: The FP cost, assessed against the person(s) named" (p404) — which
   * may be the one praying or the one prayed for, and may be a figure, a third
   * of all he has, or the Crit Die of the roll just made.
   *
   * @param {Item} act
   * @param {{performer: Actor, recipient: Actor|null}} people
   * @param {object|null} roll
   * @returns {Promise<{label: string}>}
   */
  async #payFaithCost(act, people, roll) {
    const { charges, offering, unread } = parseFaithCost(act.system.costText);
    const told = [];
    let mine = 0;

    for (const charge of charges) {
      const who = charge.of === "recipient" ? people.recipient : people.performer;
      if (!who) continue;

      let fatigue = charge.fatigue ?? 0;
      if (charge.critDie) fatigue = Math.max(0, roll?.critTotal ?? 0);
      if (charge.fractionOfTotal) {
        fatigue = Math.ceil((who.system.fatigue.max ?? 0) * charge.fractionOfTotal);
      }
      if (!fatigue) continue;

      // A clergyman spends the Belief of those worshipping with him before he
      // spends himself (p403) — which is the only way the costlier Acts can be
      // paid for at all.
      let fromPool = 0;
      if (who === people.performer) {
        fromPool = Math.min(fatigue, this.system.faith.beliefPool ?? 0);
        if (fromPool) {
          await this.update({ "system.faith.beliefPool": this.system.faith.beliefPool - fromPool });
          told.push(game.i18n.format("CNS5.Belief.spent", { fp: fromPool }));
        }
      }

      const own = fatigue - fromPool;
      if (own) await who.spendMagickCost(own);
      if (who === people.performer) mine += own;
      told.push(
        game.i18n.format(charge.perHour ? "CNS5.Faith.costPerHour" : "CNS5.Faith.cost", {
          fp: fatigue,
          name: who.name
        })
      );
    }

    if (offering) told.push(game.i18n.format("CNS5.Faith.offering", { offering }));
    if (unread) told.push(game.i18n.format("CNS5.Faith.costUnread", { text: unread }));

    // Spirit is expended against what the intercessor himself paid, not against
    // what was taken from the one prayed for.
    return { label: told.join("; "), fatigue: mine };
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
   * Attempt a skill the character does not have.
   *
   * "Some skills cannot be attempted unless the character has basic knowledge
   * of the skill" (p33) — which means the rest can. A character with no
   * Swimming skill can still try to swim, at the Unskilled BCS of its
   * Difficulty Factor rather than the Skilled one, with no bonus for level or
   * category, and a failed attempt worsens the Crit Die by two.
   *
   * Nothing is added to the sheet. A skill a character does not have is not
   * something they own, and a list of every skill they might one day attempt
   * would be the whole book.
   *
   * @param {object} skill   a row from the skills compendium
   * @param {object} [options]
   * @returns {Promise<ChatMessage|null>}
   */
  async attemptUnskilled(skill, { modifier = 0, skipDialog = false } = {}) {
    if (skill.trainingRequired) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Skill.trainingRequired", { skill: skill.name })
      );
      return null;
    }

    const band = CNS5.difficultyFactors[skill.df];
    if (!band) return null;

    const title = game.i18n.format("CNS5.Roll.unskilledTitle", { skill: skill.name });

    let situational = modifier;
    if (!skipDialog) {
      const prompted = await promptModifier(title);
      if (prompted === null) return null;
      situational += prompted.modifier;
    }

    // Attributes are the character's whether or not they have been trained, so
    // their bonuses apply. What does not is anything that comes from knowing
    // the skill: no level, no category, no mastery.
    const attributeBonus = (skill.attributes ?? []).reduce(
      (total, key) => total + (this.system.attr[key]?.bonus ?? 0),
      0
    );

    const unclamped = band.unskilled + attributeBonus + situational;
    const { target, critMod, overflow, shortfall } = clampSuccessChance(unclamped, skill.df);

    const result = await resolveCheck({
      target,
      critMod,
      // A failed attempt at something never learnt goes worse than a failure by
      // someone who knows the work (p38).
      failureCritMod: -2
    });

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format("CNS5.Roll.unskilledSubtitle", {
        df: skill.df,
        difficulty: game.i18n.localize(`CNS5.Difficulty.${skill.df}`),
        target
      }),
      unclamped,
      overflow,
      shortfall,
      unskilled: true,
      breakdown: this.#breakdown([
        { label: "CNS5.Roll.bcsUnskilled", value: band.unskilled },
        { label: "CNS5.Roll.attributes", value: attributeBonus, signed: true },
        { label: "CNS5.Roll.situational", value: situational, signed: true }
      ])
    });
  }

  /* -------------------------------------------- */

  /**
   * Cast a spell held in a magickal item (p301).
   *
   * The item casts with the skill of the mage who made it, not of whoever is
   * holding it: its chance, its targeting and the target's save are all
   * measured against the maker's figures. That is why a man with no magick in
   * him can use a wand or read a scroll.
   *
   * Before any targeting, the spell has to be got out of the item, and how
   * depends on what the item is:
   *
   *  - a **Device** activates automatically for a caster who knows the spell at
   *    MR 0, and otherwise at the maker's chance less 5% a point of the spell's
   *    Magick Resistance — always so for a non-mage. A success costs one
   *    charge; a failure costs a charge for every point of Magick Resistance,
   *    and the spell goes nowhere.
   *  - a **Scroll** is read at its writer's chance, and crumbles either way.
   *  - a **Focus** is the mage's own, holding spells he placed in it himself;
   *    each costs "1 charge per Spell MR".
   *
   * Only then is the spell targeted, and only then may its target resist.
   *
   * @param {string} itemId
   * @param {number} index   which spell the item holds
   * @param {object} [options]
   * @returns {Promise<ChatMessage|null>}
   */
  async castFromDevice(itemId, index, { skipDialog = false } = {}) {
    const item = this.items.get(itemId);
    if (!item || item.type !== "magickalItem") return null;

    const kind = item.system.kind;
    const held = item.system.spells[index];
    if (!held) return null;

    // A mage's own book is read to cast a spell he knows only in part, and it
    // casts that spell "as if he had learnt it fully" at twice the time (p307).
    // It is his own casting, with his own skill — so it is handed to the
    // ordinary casting of his own spell rather than resolved here.
    const ownBook =
      kind === "book" && (!item.system.writtenBy || item.system.writtenBy === this.name);
    if (ownBook) {
      const spell = this.items.find(
        (i) => i.type === "spell" && i.name.toLowerCase() === held.name.toLowerCase()
      );
      if (!spell) {
        ui.notifications.warn(game.i18n.format("CNS5.Book.notLearning", { spell: held.name }));
        return null;
      }
      return this.rollSpell(spell.id, "short", { skipDialog, fromBook: true });
    }

    if (item.system.spent) {
      ui.notifications.warn(
        game.i18n.format(kind === "scroll" ? "CNS5.Scroll.spent" : "CNS5.Device.spent", {
          item: item.name
        })
      );
      return null;
    }

    // A Focus stores spells at one charge a point of Magick Resistance.
    if (kind === "focus" && item.system.charges < Math.max(1, held.mr)) {
      ui.notifications.warn(game.i18n.format("CNS5.Device.spent", { item: item.name }));
      return null;
    }

    const title = game.i18n.format("CNS5.Device.castTitle", { spell: held.name, item: item.name });
    const isMage =
      Boolean(this.system.magick?.mode) || CNS5.knownMethods([...this.items]).length > 0;

    // Knowing the spell at MR 0 is what lets a Device activate without a roll.
    // A spell on the sheet is taken as learnt: nothing yet records a spell
    // learnt only partway, so there is no finer answer to give. A non-mage
    // never knows it, the penalty applying to them "automatically".
    const known =
      isMage &&
      this.items.some((i) => i.type === "spell" && i.name.toLowerCase() === held.name.toLowerCase());

    /* -- Declaring the casting --------------------------------------------- */

    // Asked before anything is rolled. The mana of the place bears on what
    // the casting costs, and the cost is paid whether or not the spell comes
    // out of the item — so it has to be known before step 2, not after it.
    const tables = await magickTables();
    const target = [...game.user.targets][0]?.actor ?? null;
    const resistance = intrinsicResistance(target, tables.targetResistance);

    let declared = {
      mana: "average", range: "short", dodgePsf: 0, resistance: null,
      willing: false, movement: [], obstacles: [], situational: 0,
      materialComponent: false, saveReductions: {}
    };

    if (!skipDialog) {
      const answered = await promptTargeting(
        { name: held.name },
        { tables, resistance, targetName: target?.name ?? null, fromDevice: true }
      );
      if (answered === null) return null;
      declared = answered;
    }

    const rolls = [];
    const parts = [];

    /* -- Step 2: getting the spell out of the item -------------------------- */

    let released = true;
    let chargesSpent = 0;
    let activation = null;
    let castRoll = null;

    if (kind === "device") {
      activation = CNS5.deviceActivation({ makerTsc: item.system.makerTsc, mr: held.mr, known });
      if (!activation.automatic) {
        const { target: need, critMod } = clampSuccessChance(
          activation.chance,
          item.system.makerDf
        );
        const roll = await resolveCheck({ target: need, critMod });
        rolls.push(...roll.rolls);
        castRoll = roll;
        released = roll.success;
        activation.roll = roll.roll;
        activation.need = need;
      }
      chargesSpent = released ? activation.chargesOnSuccess : activation.chargesOnFailure;
    } else if (kind === "scroll" || kind === "book") {
      // "The basic chance of casting the spell through a Magickal device is
      // equal to the Method of Magick TSC% of the Magick User who wrote the
      // scroll... On a failure, the scroll or page is discharged."
      const { target: need, critMod } = clampSuccessChance(
        item.system.makerTsc,
        item.system.makerDf
      );
      const roll = await resolveCheck({ target: need, critMod });
      rolls.push(...roll.rolls);
      castRoll = roll;
      released = roll.success;
      activation = { automatic: false, roll: roll.roll, need, chance: item.system.makerTsc };
    } else {
      chargesSpent = Math.max(1, held.mr);
    }

    // Spent whatever came of it — except a book, which loses only the page of
    // a spell that failed: "on a failure, the scroll or page is discharged".
    if (kind === "scroll") {
      await item.update({ "system.discharged": true });
    } else if (kind === "book") {
      if (!released) {
        await item.update({
          "system.spells": item.system.spells.filter((_, i) => i !== index)
        });
      }
    } else {
      await item.update({
        "system.charges": Math.max(0, item.system.charges - chargesSpent)
      });
    }

    // What the bearer pays in Fatigue (p297): a quarter for a mage and half for
    // anyone else from a device; half from a scroll. A spell stored in a Focus
    // is paid for in charges.
    const place = CNS5.manaLevels[declared.mana] ?? CNS5.manaLevels.average;
    const fatigue =
      kind === "focus"
        ? 0
        : kind === "scroll" || kind === "book"
          ? Math.ceil(held.fp * CNS5.castingSources.scroll.fatigue * place.fatigue)
          : CNS5.deviceFatigue(held.fp, isMage, declared.mana);

    // Which of p297's rates applied, so a card showing 2 FP for a spell that
    // costs 6 says why: a quarter of it, being a mage.
    const rateKey =
      kind === "focus"
        ? "focus"
        : kind === "scroll" || kind === "book"
          ? kind
          : isMage
            ? "deviceMage"
            : "deviceOther";
    await this.spendMagickCost(fatigue);

    // Step 1, named for what it was: reading a scroll, coaxing a device,
    // drawing on a Focus's store. Only the first two are ever rolled.
    const castingStep = {
      heading: game.i18n.localize("CNS5.Step.casting"),
      text: game.i18n.localize(
        kind === "scroll"
          ? "CNS5.Step.readScroll"
          : kind === "book"
            ? "CNS5.Step.readBook"
          : kind === "focus"
            ? "CNS5.Step.fromFocus"
            : activation?.automatic
              ? "CNS5.Step.deviceKnown"
              : "CNS5.Step.deviceUnknown"
      ),
      rolled: Boolean(castRoll),
      roll: castRoll?.roll ?? null,
      need: activation?.need ?? null,
      success: released,
      outcome: game.i18n.localize(released ? "CNS5.Step.cast" : "CNS5.Step.notCast")
    };

    const manaNote =
      place.fatigue === 1 ? "" : `, ${game.i18n.localize(`CNS5.Mana.costNote.${declared.mana}`)}`;
    const fatiguePart =
      kind === "focus"
        ? game.i18n.localize("CNS5.Rate.focus")
        : game.i18n.format("CNS5.Rate.fatigue", {
            fp: fatigue,
            share: game.i18n.localize(`CNS5.Rate.share.${rateKey}`),
            base: held.fp,
            reason: game.i18n.localize(`CNS5.Rate.reason.${rateKey}`),
            mana: manaNote
          });

    const costLabel = game.i18n.format(
      kind === "scroll"
        ? "CNS5.Scroll.costs"
        : kind === "book"
          ? "CNS5.Book.costs"
          : "CNS5.Device.costs",
      {
        fatigue: fatiguePart,
        spent: chargesSpent,
        left: Math.max(0, item.system.charges - chargesSpent)
      }
    );

    // A spell that never left the item has nothing to target. Its card shows
    // the casting roll as its dice, headed as the step it was, and says so.
    if (!released) {
      return checkToMessage(this, {
        ...castRoll,
        rolls,
        title,
        subtitle: game.i18n.format("CNS5.Device.castSubtitle", {
          maker: item.system.makerTsc,
          target: activation?.need ?? 0
        }),
        targetingHeading: castingStep.heading,
        nothingToTarget: game.i18n.localize(
          kind === "scroll"
            ? "CNS5.Scroll.failed"
            : kind === "book"
              ? "CNS5.Book.failed"
              : "CNS5.Device.failed"
        ),
        cost: costLabel
      });
    }

    /* -- Step 3: targeting ------------------------------------------------- */

    /* -- A non-mage aiming (p299) ------------------------------------------ */

    // "Any non-Mage trying to target a spell (unless it is a touch effect
    // whereby a blow is required) must first succeed with a Willpower roll."
    // Mages never check: "they are attuned with Magick and know how to target
    // spells". On a failure the spell goes astray, and Table - Willpower
    // Failure says where — though its last band is a reprieve.
    let willpowerStep = null;
    const reach = parseMagnitude(held.rangeText, "distance");
    const byTouch = reach.kind === "word" && /touch/i.test(reach.label ?? "");

    if (!isMage && !byTouch) {
      const willpower = this.items.find(
        (i) => i.type === "skill" && i.name.toLowerCase() === "willpower"
      );
      // Without the skill it is tried untrained, at the chance its Difficulty
      // Factor gives to anyone.
      const band = CNS5.difficultyFactors[willpower?.system.df ?? 3];
      const need = willpower ? willpower.system.tsc : band.unskilled;
      const { target: clamped, critMod: wCrit } = clampSuccessChance(
        need,
        willpower?.system.df ?? 3
      );
      const check = await resolveCheck({ target: clamped, critMod: wCrit });
      rolls.push(...check.rolls);

      let astray = null;
      if (!check.success) {
        const where = await new Roll("1d100").evaluate();
        rolls.push(where);
        astray = { roll: where.total, ...CNS5.readWillpowerFailure(where.total) };
      }

      willpowerStep = {
        heading: game.i18n.localize("CNS5.Step.willpower"),
        text: game.i18n.localize("CNS5.Step.willpowerText"),
        rolled: true,
        roll: check.roll,
        need: clamped,
        success: check.success || Boolean(astray?.corrected),
        outcome: game.i18n.localize(
          check.success ? "CNS5.Step.aimed" : astray?.corrected ? "CNS5.Step.corrected" : "CNS5.Step.astray"
        )
      };

      // Gone astray: there is no target to roll against. Where it went is the
      // Gamemaster's to settle from the table's result.
      if (!check.success && !astray.corrected) {
        return checkToMessage(this, {
          ...check,
          rolls,
          title,
          subtitle: game.i18n.format("CNS5.Device.castSubtitle", {
            maker: item.system.makerTsc,
            target: clamped
          }),
          castingStep,
          targetingHeading: willpowerStep.heading,
          nothingToTarget: game.i18n.format(`CNS5.Astray.${astray.key}`, { roll: astray.roll }),
          cost: costLabel
        });
      }
    }

    const targeting = resolveTargeting({
      methodTsc: item.system.makerTsc,
      resistance: declared.resistance ?? resistance.value,
      range: declared.range,
      movement: declared.movement,
      obstacles: declared.obstacles,
      willing: declared.willing,
      dodgePsf: declared.dodgePsf,
      manaBonus: CNS5.manaLevels[declared.mana]?.tsc ?? 0,
      situational:
        declared.situational + (declared.materialComponent ? CNS5.materialComponentBonus : 0),
      tables
    });

    if (targeting.impenetrable) {
      ui.notifications.warn(
        game.i18n.format("CNS5.Targeting.blocked", { obstacle: targeting.impenetrableBy })
      );
      return null;
    }

    const { target: chance, critMod, overflow, shortfall } = clampSuccessChance(
      targeting.total,
      item.system.makerDf
    );
    // Whatever protects the target is targeted first (p298), at the maker's
    // skill like everything else a device does.
    const pierced = await this.#pierceDefences({
      target,
      targeting,
      difficulty: item.system.makerDf
    });
    rolls.push(...pierced.rolls);

    if (!pierced.through) {
      return checkToMessage(this, {
        ...(await resolveCheck({ target: chance, critMod })),
        rolls,
        title,
        subtitle: game.i18n.format("CNS5.Device.castSubtitle", {
          maker: item.system.makerTsc,
          target: chance
        }),
        castingStep,
        willpowerStep,
        defenceSteps: pierced.steps,
        nothingToTarget: game.i18n.format("CNS5.Defence.blocked", {
          name: pierced.stoppedBy.name
        }),
        cost: costLabel
      });
    }

    const result = await resolveCheck({ target: chance, critMod });
    result.rolls.unshift(...rolls);

    /* -- Step 4: the save --------------------------------------------------- */

    let save = null;
    const offersSave = target && CNS5.isResistable({ name: held.name, resisted: held.resisted });
    if (result.success && offersSave) {
      save = await target.resistSpell({
        casterPsf: item.system.makerPsf,
        presence: this.system.attr.bv?.value ?? 0,
        // "Saves cannot be reduced through Meditation and fasting."
        reductions: { ...declared.saveReductions, meditationDays: 0 }
      });
      if (save) result.rolls.push(...save.rolls);
    }

    return checkToMessage(this, {
      ...result,
      title,
      subtitle: game.i18n.format(
        kind === "scroll" ? "CNS5.Scroll.castSubtitle" : "CNS5.Device.castSubtitle",
        { maker: item.system.makerTsc, target: chance }
      ),
      // Two rolls are made — one to get the spell out of the item, one to aim
      // it — and the card's dice show only the second. Saying which is which
      // is the difference between a card that reads and one that looks like it
      // rolled twice for no reason.
      castingStep,
      willpowerStep,
      defenceSteps: pierced.steps,
      targetingHeading: game.i18n.localize("CNS5.Step.targeting"),
      saveHeading: game.i18n.localize("CNS5.Step.save"),
      unclamped: targeting.total,
      overflow,
      shortfall,
      targetName: target?.name ?? null,
      cost: costLabel,
      save,
      saveLabel: save
        ? game.i18n.format(save.resisted ? "CNS5.Save.resisted" : "CNS5.Save.failed", {
            name: target.name,
            roll: save.roll,
            chance: save.chance
          })
        : null,
      saveCertain: save?.certain ? game.i18n.localize(`CNS5.Save.${save.certain}`) : null,
      offersSave: Boolean(offersSave),
      breakdown: this.#breakdown([
        { label: "CNS5.Device.makerSkill", value: item.system.makerTsc },
        { label: "CNS5.Targeting.resistance", value: -targeting.resistance, signed: true },
        { label: "CNS5.Roll.rangeBand", value: targeting.rangeModifier, signed: true },
        { label: "CNS5.Targeting.movement", value: targeting.movementTotal, signed: true },
        { label: "CNS5.Targeting.obstacles", value: targeting.obstacleTotal, signed: true },
        { label: "CNS5.Targeting.willingShort", value: targeting.willingBonus, signed: true },
        { label: "CNS5.Targeting.dodge", value: -targeting.dodgePsf, signed: true },
        { label: "CNS5.Mana.bonus", value: targeting.manaBonus, signed: true },
        { label: "CNS5.Roll.situational", value: targeting.situational, signed: true }
      ])
    });
  }

  /* -------------------------------------------- */

  /**
   * Work a spell through whatever protects its target (p298).
   *
   * Each protection is targeted in its own right, outermost first, at the same
   * chance as the victim would be but resisting by its own Magick Resistance.
   * A spell that fails against one goes no further — "the Circle or Ward must
   * itself be targeted in order for the spell to penetrate".
   *
   * @param {object} options
   * @returns {Promise<{through: boolean, steps: Array, rolls: Array, stoppedBy: object|null}>}
   */
  async #pierceDefences({ target, targeting, difficulty, harmful = true }) {
    const defences = magickalDefences(target);
    const steps = [];
    const rolls = [];

    for (const defence of defences) {
      // The same shot, against this protection's own resistance rather than
      // the victim's.
      const against = targeting.total + targeting.resistance - defence.mr;
      const { target: need, critMod } = clampSuccessChance(against, difficulty);
      const roll = await resolveCheck({ target: need, critMod });
      rolls.push(...roll.rolls);

      const step = {
        heading: game.i18n.format("CNS5.Defence.heading", {
          kind: game.i18n.localize(`CNS5.Magickal.${defence.kind}`)
        }),
        text: game.i18n.format("CNS5.Defence.text", { name: defence.name, mr: defence.mr }),
        rolled: true,
        roll: roll.roll,
        need,
        success: roll.success,
        outcome: game.i18n.localize(roll.success ? "CNS5.Defence.through" : "CNS5.Defence.stopped")
      };
      steps.push(step);

      if (!roll.success) {
        // A Focus that fails to stop a spell may turn on its bearer.
        if (defence.backfires) {
          const chance = await new Roll("1d100").evaluate();
          rolls.push(chance);
          step.note = game.i18n.format(
            chance.total <= CNS5.focusDefenceBackfire
              ? "CNS5.Defence.focusBackfired"
              : "CNS5.Defence.focusHeld",
            { roll: chance.total, chance: CNS5.focusDefenceBackfire }
          );
        }
        return { through: false, steps, rolls, stoppedBy: defence };
      }

      // "If such an amulet is overcome, the defensive spell will discharge for
      // 1D10 days if the spell overcoming it was of a harmful nature."
      if (defence.kind === "amulet" && harmful) {
        const days = await new Roll(CNS5.amuletDischargeDays).evaluate();
        rolls.push(days);
        step.note = game.i18n.format("CNS5.Defence.amuletDischarged", { days: days.total });
      }
    }

    return { through: true, steps, rolls, stoppedBy: null };
  }

  /* -------------------------------------------- */

  /**
   * Resist a spell cast at this character (p300).
   *
   * "To make a Resisted Roll, the target must make a Willpower TSC% - Caster's
   * Method of Magick PSF%." The Method of Magick is the school the spell
   * belongs to — Command Magick, Illusion Magick — not the caster's tradition.
   *
   * The two bounds are checked against the unmodified die, which is what keeps
   * a save from ever being hopeless: the weakest will sometimes shrug off the
   * strongest mage, and the strongest will sometimes fail against a cantrip.
   *
   * @param {object} options
   * @returns {Promise<object|null>} null where this character cannot resist
   */
  async resistSpell({ casterPsf = 0, presence = 0, reductions = {} } = {}) {
    const willpower = this.items.find(
      (i) => i.type === "skill" && i.name.toLowerCase() === "willpower"
    );
    if (!willpower) return null;

    const { chance, parts } = CNS5.resistanceChance({
      willpowerTsc: willpower.system.tsc,
      casterPsf,
      presence,
      ...reductions
    });

    const roll = await new Roll("1d100").evaluate();
    const outcome = CNS5.readResistance(roll.total, chance);

    return {
      ...outcome,
      roll: roll.total,
      rolls: [roll],
      chance,
      parts,
      skillName: willpower.name
    };
  }

  /* -------------------------------------------- */

  /**
   * Pay for a spell.
   *
   * "This costs the Mage Fatigue Points (FP), or if exhausted, Body Points"
   * (p296) — so a caster with nothing left in reserve pays out of their own
   * substance, which is how a desperate mage kills himself casting.
   *
   * @param {number} fatigue
   * @returns {Promise<{fromFatigue: number, fromBody: number}>}
   */
  async spendMagickCost(fatigue) {
    if (!(fatigue > 0)) return { fromFatigue: 0, fromBody: 0 };

    const available = Math.max(0, this.system.fatigue.value);
    const fromFatigue = Math.min(fatigue, available);
    const fromBody = fatigue - fromFatigue;

    const before = this.system.condition.state;
    await this.update({
      "system.fatigue.value": available - fromFatigue,
      "system.body.value": this.system.body.value - fromBody
    });
    await this.#announceCondition(before);

    return { fromFatigue, fromBody };
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

    const before = this.system.condition.state;

    await this.update({
      "system.fatigue.value": Math.max(0, this.system.fatigue.value - split.fatigueLost),
      // Body is deliberately allowed below zero. The distance below it is the
      // whole of what decides whether a character lives (p282), so flooring it
      // would throw away the only figure that matters.
      "system.body.value": this.system.body.value - split.bodyLost
    });

    await this.#announceCondition(before);
    return this;
  }

  /* -------------------------------------------- */

  /**
   * What a combat advantage entitles its holder to (p280-281).
   *
   * An ordinary success lets the defender attack in turn if they are next in
   * line, which needs nothing from the system. A Critical Success does more,
   * and what it does depends on what was interposed — so the card says which,
   * and what it costs, and leaves the taking of it to the player.
   *
   * @param {Actor|null} defender
   * @param {object|null} defence
   * @returns {object|null}
   */
  #describeAdvantage(defender, defence) {
    if (!defender || !defence) return null;

    const entry = CNS5.combatAdvantages[defence.defence];
    const plain = { label: "CNS5.Advantage.attackInTurn", bonus: 0, cost: 0 };
    if (!entry) return plain;

    // Only a Critical Success buys the better follow-ups.
    if (entry.criticalOnly && !defence.critical) return plain;

    const item = defence.itemName
      ? defender.items.find((i) => i.name === defence.itemName)
      : null;
    const weight = item?.system?.defenceWeight ?? item?.system?.weightClass ?? "medium";
    const band = CNS5.advantageWeightOf[weight] ?? weight;

    return {
      label: entry.label,
      bonus: entry.bonus,
      cost: CNS5.combatAdvantageCost[band] ?? 0,
      opposedByStrength: Boolean(entry.opposedByStrength),
      // A disarm is resisted by the attacker's Strength at a penalty equal to
      // the defender's own skill, so the figure they must beat is worth naming.
      penalty: entry.opposedByStrength ? -(defence.psf ?? 0) : 0,
      restricted: CNS5.advantageRestricted.includes(band)
    };
  }

  /* -------------------------------------------- */


  /**
   * Say when a character falls or dies, and mark the token.
   *
   * A wound that takes someone below zero is the most consequential thing that
   * happens in a fight, and it is a number quietly changing on a sheet nobody
   * may be looking at. So it is announced, once, at the moment it happens —
   * not repeated for every blow that lands on a man already down.
   *
   * @param {string} before  the state before the blow
   */
  async #announceCondition(before) {
    const after = this.system.condition.state;
    if (after === before) return;

    const effect = { unconscious: "unconscious", dead: "dead" }[after];
    if (effect && CONFIG.statusEffects.some((e) => e.id === effect)) {
      // Mark the token, so a fight can be read from the canvas.
      await this.toggleStatusEffect(effect, { active: true });
    }
    if (before === "unconscious" && after === "standing") {
      await this.toggleStatusEffect("unconscious", { active: false });
    }

    if (after === "standing") return;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<p class="cns5-condition is-${after}">${game.i18n.format(
        after === "dead" ? "CNS5.Condition.died" : "CNS5.Condition.fell",
        {
          name: this.name,
          body: this.system.body.value,
          margin: this.system.condition.margin,
          deathAt: this.system.condition.deathAt
        }
      )}</p>`
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
