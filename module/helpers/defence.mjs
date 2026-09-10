import { CNS5 } from "../config.mjs";
import { clampSuccessChance, resolveCheck } from "./checks.mjs";

/**
 * Defences (pp.270, 278-280).
 *
 * The two forms of combat differ in where the defence is felt. Under **basic**
 * combat the defender never rolls: a share of their Personal Skill Factor comes
 * off the attacker's Total Success Chance, half for an active defence and a
 * quarter for a passive one, and the single attack roll settles everything.
 *
 * Under **advanced** combat both sides roll and the pair is read together. That
 * is what makes it possible for a shield to stop a blow and absorb it, or for a
 * failed attack met by a successful defence to hand the defender an advantage —
 * neither of which basic combat can express, because there is nothing there for
 * the defence to succeed or fail at.
 */

/* -------------------------------------------- */

/**
 * Find the skill a declared defence is rolled with.
 *
 * Dodge always uses Dodge. A weapon parry uses whatever the defender is holding
 * — which is why it is found from the equipped weapon rather than named here —
 * and a shield block uses the shield play skill for the shield's weight.
 *
 * @param {Actor} defender
 * @param {string} defence  a key of CNS5.defences
 * @returns {{skill: Item|null, item: Item|null, bonus: number}}
 */
export function defenceSkill(defender, defence) {
  const skills = defender.items.filter((i) => i.type === "skill");
  const byName = (name) =>
    skills.find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? null;

  if (defence === "dodge") {
    const skill = byName("Dodge");
    return {
      skill,
      item: null,
      bonus: 0,
      fatigue: CNS5.defenceFatigueCost("dodge", skill?.system.psf ?? 0)
    };
  }

  if (defence === "weaponParry") {
    // The weapon in hand, and the combat skill that goes with it.
    const weapon = defender.items.find((i) => i.type === "weapon" && i.system.equipped);
    const skill = weapon?.system.skillItem ?? null;
    return {
      skill,
      item: weapon ?? null,
      bonus: 0,
      fatigue: weapon
        ? CNS5.defenceFatigueCost(weapon.system.weightClass, skill?.system.psf ?? 0)
        : 0
    };
  }

  if (defence === "shieldBlock") {
    const shield = defender.items.find(
      (i) => i.type === "armour" && i.system.location === "shield" && i.system.equipped
    );
    const heavy = shield?.system.weightClass !== "light";
    const skill = byName(heavy ? "Shield Play: Heavy" : "Shield Play: Light");
    return {
      skill,
      item: shield ?? null,
      // Shields are built to block, and the table gives each its own bonus.
      bonus: shield?.system.blockBonus ?? 0,
      fatigue: shield
        ? CNS5.defenceFatigueCost(shield.system.defenceWeight, skill?.system.psf ?? 0)
        : 0
    };
  }

  return { skill: null, item: null, bonus: 0, fatigue: 0 };
}

/* -------------------------------------------- */

/**
 * The reduction a declared defence makes to the attacker's chance under basic
 * combat: half the defender's PSF% for an active defence, a quarter for a
 * passive one (p270).
 *
 * @param {Actor} defender
 * @param {string} defence
 * @returns {{modifier: number, psf: number, stance: string|null, skill: Item|null}}
 */
export function basicDefence(defender, defence) {
  const entry = CNS5.defences[defence];
  if (!entry?.stance) return { modifier: 0, psf: 0, stance: null, skill: null };

  // A passive defence is the defender giving ground rather than committing to
  // any one thing, so it is measured against whatever they would have used.
  const found = defenceSkill(defender, defence === "passive" ? "dodge" : defence);
  const psf = found.skill?.system.psf ?? 0;
  const share = CNS5.defenceShare[entry.stance] ?? 0;

  return {
    modifier: -Math.floor(psf * share),
    psf,
    stance: entry.stance,
    skill: found.skill,
    // Making the defence costs Fatigue under either form of combat; only the
    // rolling differs. A passive defence is not an active one and costs none.
    fatigueCost: entry.stance === "active" ? found.fatigue ?? 0 : 0
  };
}

/* -------------------------------------------- */

/**
 * Roll a defence under advanced combat.
 *
 * A weapon parry is made at the defender's skill less the attacker's PSF%: the
 * better the attacker, the harder their blow is to turn. A dodge takes the
 * penalty for what the defender is wearing. A shield block gains the shield's
 * own bonus.
 *
 * @param {Actor} defender
 * @param {string} defence
 * @param {object} attack  the resolved attack
 * @returns {Promise<object|null>} null if the defence cannot be attempted
 */
export async function rollDefence(defender, defence, attack) {
  const found = defenceSkill(defender, defence);
  if (!found.skill) return null;

  const skill = found.skill.system;
  const armour = defence === "dodge" ? defender.system.dodgePenalty ?? 0 : 0;
  const opposed = CNS5.defenceModifiers[defence]?.opposedByAttackerPsf
    ? -(attack.attackerPsf ?? 0)
    : 0;

  const unclamped = skill.tsc + found.bonus + armour + opposed;
  const { target, critMod } = clampSuccessChance(unclamped, skill.df);
  const result = await resolveCheck({ target, critMod });

  return {
    ...result,
    defence,
    skillName: found.skill.name,
    itemName: found.item?.name ?? null,
    shieldBonus: found.bonus,
    armourPenalty: armour,
    attackerPsf: opposed,
    // Every active defence costs Fatigue whether or not it succeeds (p278).
    fatigueCost: found.fatigue ?? 0,
    unclamped
  };
}

/* -------------------------------------------- */

/**
 * Read an attack and a defence together (p270).
 *
 * The four outcomes the rules give, in the order they give them:
 *
 *   - attack succeeds, defence fails or was not made — the blow lands;
 *   - attack succeeds and defence succeeds — the defending item absorbs it;
 *   - attack fails and defence succeeds — the defender gains a combat
 *     advantage;
 *   - a Critical Success needs a Critical Success to turn away entirely. A
 *     plain success against one reduces the blow to an ordinary hit rather than
 *     stopping it.
 *
 * @param {object} attack
 * @param {object|null} defence
 * @returns {{outcome: string, damage: boolean, reduced: boolean, advantage: boolean}}
 */
export function resolveExchange(attack, defence) {
  if (!defence || !defence.success) {
    return attack.success
      ? { outcome: "hit", damage: true, reduced: false, advantage: false }
      : { outcome: "miss", damage: false, reduced: false, advantage: false };
  }

  // The defence succeeded.
  if (!attack.success) {
    return { outcome: "advantage", damage: false, reduced: false, advantage: true };
  }

  // A critical attack is only turned away entirely by a critical defence. A
  // plain success against one reduces it "to that of a normal attack success"
  // (p270) — so the blow still lands with its Crit Die, and only the extra d10
  // that a critical would have added is lost.
  if (attack.critical && !defence.critical) {
    return { outcome: "reduced", damage: true, reduced: true, advantage: false };
  }

  return { outcome: "blocked", damage: false, reduced: false, advantage: false };
}

/* -------------------------------------------- */

/**
 * Whether a shield that stopped more than it can absorb has broken (p279).
 *
 * The chance is cumulative and stays with the shield after the fight unless it
 * is repaired, so it is read from and written back to the item.
 *
 * @param {Item} shield
 * @param {number} damage  the damage the blow carried
 * @returns {Promise<{overwhelmed: boolean, chance: number, roll: number, broken: boolean}|null>}
 */
export async function checkShield(shield, damage, damageType) {
  if (!shield) return null;

  const absorbs = shield.system.absorption?.[damageType] ?? 0;
  const chance = shield.system.failureChance ?? 0;
  if (damage <= absorbs) return { overwhelmed: false, chance, roll: 0, broken: false };

  const raised = chance + CNS5.shieldFailureStep;
  const roll = await new Roll("1d100").evaluate();
  return { overwhelmed: true, chance: raised, roll: roll.total, broken: roll.total <= raised };
}
