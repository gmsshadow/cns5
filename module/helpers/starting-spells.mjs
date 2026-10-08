/**
 * Starting spells (p295).
 *
 * "This gives the total number of Spell Points available to the character to
 * purchase his initial starting spells. The spells can be purchased at a rate
 * of 1 Spell Point equals one Spell MR. A Mage can use 10 Spell Points to
 * purchase a simple focus with which to start the game."
 *
 * A spell's MR here is the one this mage learns it at: his tradition raises or
 * lowers it by Table - Spell Magick Resistance Modifiers, within 1 and 10
 * (p294). That is the MR he enchants and so the one he has paid for.
 */

import { CNS5 } from "../config.mjs";

/** Spells the tables print with no Method, and what they need instead. */
const ANY_METHOD = "Common Method Spells";
const ANY_ELEMENT = "Common Elemental Control Spells";

/**
 * What a spell costs this mage, and whether he can cast it.
 *
 * @param {{name: string, mr: number, mrNote?: string, mode?: string, group?: string}} spell
 * @param {object} mage
 * @param {string} mage.mode          his Mode of Magick
 * @param {number} mage.ml            his Magick Level
 * @param {string[]} mage.methods     the Methods of Magick he knows
 * @returns {{cost: number, modifier: number, surcharge: number, method: string,
 *            castable: boolean, learnable: boolean, variable: boolean}}
 */
export function spellCost(spell, { mode = "", ml = 0, methods = [] } = {}) {
  const method = CNS5.spellMethod(spell);
  const learning = CNS5.effectiveLearningMr({ mr: spell.mr, method, mode });
  const known = new Set(methods.map((m) => m.toLowerCase()));
  let castable;
  if (method) castable = known.has(method.toLowerCase());
  else if (spell.group === ANY_METHOD) castable = known.size > 0;
  else if (spell.group === ANY_ELEMENT) castable = [...known].some((m) => m.startsWith("basic magick"));
  // A spell the tables leave without a Method — the Healing Spells, the
  // Common Spells — is not held against him.
  else castable = true;

  return {
    cost: learning.effective,
    modifier: learning.modifier,
    surcharge: learning.fatigueSurcharge,
    method,
    castable,
    learnable: learning.effective <= CNS5.maxLearnableMr(ml),
    variable: Boolean(spell.mrNote)
  };
}

/**
 * What the starting spells come to, and what breaks the rule.
 *
 * @param {object} args
 * @param {Array<{name: string, cost: number, castable: boolean, learnable: boolean}>} args.picks
 * @param {boolean} args.focus   whether a simple focus is bought
 * @param {number} args.points   Spell Points available
 * @param {number} args.held     Spell Points already spent on spells he has
 * @param {number} args.ml
 * @returns {{spent: number, left: number, problems: Array<{key: string, data: object}>}}
 */
export function checkStartingSpells({ picks = [], focus = false, points = 0, held = 0, ml = 0 } = {}) {
  const problems = [];
  const spent = held + picks.reduce((total, p) => total + p.cost, 0) + (focus ? CNS5.simpleFocusSpellPoints : 0);
  if (spent > points) problems.push({ key: "overspent", data: { spent, points } });
  for (const p of picks) {
    if (!p.learnable) problems.push({ key: "tooHigh", data: { name: p.name, mr: p.cost, max: CNS5.maxLearnableMr(ml) } });
    if (!p.castable) problems.push({ key: "noMethod", data: { name: p.name, method: p.method || "—" } });
  }
  return { spent, left: points - spent, problems };
}
