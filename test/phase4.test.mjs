/**
 * Combat, encumbrance, currency and magick derivations.
 *
 * As with the other suites these run under plain Node, because everything
 * checked here is a pure function over a config table.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* -- Table - Magick Levels (p289) ----------------------------------------- */

/* The worked example: a Well Aspected Magus with PSF 78 has PMF 88, giving
   ML 7. Eleven further levels take PSF to 111 and PMF to 121, giving ML 11.
   When PMF reaches 122 the level rises to 12.                               */
ok("PMF 88 (worked example)", CNS5.magickLevel(78 + 10), 7);
ok("PMF 121 (worked example)", CNS5.magickLevel(111 + 10), 11);
ok("PMF 122 (worked example)", CNS5.magickLevel(122), 12);

ok("PMF 51 is the top of ML 1", CNS5.magickLevel(51), 1);
ok("PMF 52 is ML 2", CNS5.magickLevel(52), 2);
ok("PMF 58 is still ML 2", CNS5.magickLevel(58), 2);
ok("PMF 59 is ML 3", CNS5.magickLevel(59), 3);
ok("PMF 149 is ML 15", CNS5.magickLevel(149), 15);
/* The note: every further +7 above 149 adds one level. */
ok("PMF 156 is ML 16", CNS5.magickLevel(156), 16);
ok("PMF 163 is ML 17", CNS5.magickLevel(163), 17);

/* Aspect bonus runs opposite ways for the two traditions (p288). */
ok("mage, well aspected", CNS5.magickAspectBonus("well", "mage"), 10);
ok("mage, neutral", CNS5.magickAspectBonus("neutral", "mage"), 0);
ok("mage, poorly aspected", CNS5.magickAspectBonus("poor", "mage"), 10);
ok("priest-mage, neutral", CNS5.magickAspectBonus("neutral", "priestMage"), 10);
ok("priest-mage, well aspected", CNS5.magickAspectBonus("well", "priestMage"), 0);

/* -- Table - Attacker's Bonus (p282) --------------------------------------- */

ok("level 1, natural light", CNS5.attackerBonus(1, "naturalLight"), 0);
ok("level 1, two-handed", CNS5.attackerBonus(1, "twoHanded"), 2);
ok("level 6, medium", CNS5.attackerBonus(6, "medium"), 3);
ok("level 12, light", CNS5.attackerBonus(12, "light"), 3);
ok("level 13 falls in the 13-14 band", CNS5.attackerBonus(13, "heavy"), 5);
ok("level 14 falls in the 13-14 band", CNS5.attackerBonus(14, "heavy"), 5);
ok("level 17, medium", CNS5.attackerBonus(17, "medium"), 6);
ok("level 20 uses the 20+ row", CNS5.attackerBonus(20, "twoHanded"), 8);
ok("level 40 still uses the 20+ row", CNS5.attackerBonus(40, "twoHanded"), 8);
/* The table begins at level 1, so basic knowledge alone earns nothing. */
ok("level 0 earns no bonus", CNS5.attackerBonus(0, "twoHanded"), 0);

/* -- Encumbrance (p111) ---------------------------------------------------- */

/* One Fatigue Point per hour for every 20% of Carrying Capacity over, rounded
   up. With CCAP 100 that is one point per 20 lbs.                            */
const fatigue = (load, ccap) => {
  const over = Math.max(0, load - ccap);
  return over > 0 && ccap > 0 ? Math.ceil(over / (CNS5.encumbranceStep * ccap)) : 0;
};
ok("at capacity", fatigue(100, 100), 0);
ok("1 lb over", fatigue(101, 100), 1);
ok("20% over", fatigue(120, 100), 1);
ok("21% over", fatigue(121, 100), 2);
ok("100% over", fatigue(200, 100), 5);
ok("under capacity", fatigue(50, 100), 0);

/* -- Currency -------------------------------------------------------------- */

const inFarthings = (p, s, d, f) =>
  p * CNS5.currency.pounds.inFarthings +
  s * CNS5.currency.shillings.inFarthings +
  d * CNS5.currency.pence.inFarthings +
  f;

ok("a pound is twenty shillings", inFarthings(1, 0, 0, 0), inFarthings(0, 20, 0, 0));
ok("a pound is 240 pence", inFarthings(1, 0, 0, 0), inFarthings(0, 0, 240, 0));
ok("a shilling is twelve pence", inFarthings(0, 1, 0, 0), inFarthings(0, 0, 12, 0));
ok("a penny is four farthings", inFarthings(0, 0, 1, 0), 4);

/* -- Armour ---------------------------------------------------------------- */

/* Heavy and battle weight carry their own penalties to thief skills (p260)
   and to Dodge (p280).                                                       */
ok("battle armour thief penalty", CNS5.armourWeights.battle.thiefPenalty, -20);
ok("heavy armour thief penalty", CNS5.armourWeights.heavy.thiefPenalty, -10);
ok("light armour is unpenalised", CNS5.armourWeights.light.thiefPenalty, 0);
ok("battle armour dodge penalty", CNS5.dodgePenalty.battle, -20);
ok("heavy armour dodge penalty", CNS5.dodgePenalty.heavy, -10);

/* -- Spell ranges (character sheet, p599) ---------------------------------- */

ok("short range is unpenalised", CNS5.spellRanges.short.modifier, 0);
ok("long range", CNS5.spellRanges.long.modifier, -10);
ok("maximum range", CNS5.spellRanges.max.modifier, -30);

/* -- Table - Armour Modifiers and initiative (p268) ------------------------ */

/* Wearing nothing is an advantage rather than merely the absence of one. */
ok("unarmoured gains Action Points", CNS5.armourModifiers.none.ap, 3);
ok("light armour is neutral", CNS5.armourModifiers.light.ap, 0);
ok("heavy armour costs three", CNS5.armourModifiers.heavy.ap, -3);
ok("battle armour costs five", CNS5.armourModifiers.battle.ap, -5);

ok("and its flat Fatigue cost", CNS5.armourModifiers.heavy.fatigue, 1);
ok("battle armour is worse", CNS5.armourModifiers.battle.fatigue, 2);
ok("nothing lighter costs any", CNS5.armourModifiers.light.fatigue, 0);

/* Every armour weight class must have modifiers, or a character in that class
   silently gets none. */
ok(
  "every armour weight is covered",
  Object.keys(CNS5.armourWeights).filter((k) => !CNS5.armourModifiers[k]),
  []
);

ok("running out of Fatigue costs ten", CNS5.exhaustedApPenalty, -10);

/* The formula has to name a field the actor's roll data actually provides, or
   Foundry throws an unresolved-term error the moment initiative is rolled. */
ok("initiative rolls a d10", CNS5.initiativeFormula.startsWith("1d10"), true);
ok("and adds the prepared bonus", CNS5.initiativeFormula.includes("@initiative"), true);

/* The pool itself: Base Action Points, the armour modifier, and the exhaustion
   penalty when Fatigue is gone. */
const pool = (bap, armour, fatigueLeft) =>
  bap + CNS5.armourModifiers[armour].ap + (fatigueLeft <= 0 ? CNS5.exhaustedApPenalty : 0);
ok("a boar, unarmoured but for its hide", pool(12, "light", 34), 12);
ok("a knight in battle armour", pool(14, "battle", 27), 9);
ok("a naked man", pool(14, "none", 27), 17);
ok("and one who has run out of Fatigue", pool(14, "none", 0), 7);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
