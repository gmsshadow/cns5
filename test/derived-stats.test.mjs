/**
 * Derived statistics, checked against the worked examples in the rulebook.
 */

import { CNS5 } from "../module/config.mjs";

// The first version of this file printed FAIL and carried on, and exited zero
// whatever happened — so it could never have failed the build it was part of.
let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// Brother Arbutus (p106-107): 222 lb, CON 17, STR 12 -> Body 46
const wf = CNS5.weightFactor(222);
ok("Arbutus weight factor", wf, 23);
ok("Arbutus body", wf + 17 + Math.floor(12 / 2), 46);
ok("Arbutus fatigue (CON 17 + DIS 19)", 17 + Math.max(14, 19), 36);
ok("Arbutus FRR rest", CNS5.fatigueRecovery(17).rest, 6);
ok("Arbutus BRR rest", CNS5.bodyRecovery(17).rest, 8);

// Harold (p113): STR 15, AGL 13 -> jump 7, +2 human = 9
ok("Harold jump", Math.ceil((15 + 13) / 4) + 2, 9);

// Eleanor / Henry BAP (p113)
const bap = (agl, fer, int) =>
  Math.floor(Math.max(agl + Math.min(fer, 20), agl + Math.min(int, 20)) / 2);
ok("Eleanor BAP", bap(16, 8, 17), 16);
ok("Henry BAP", bap(21, 15, 10), 18);

// Attribute bonus examples (p34): STR 13 = +1, AGL 12 = +0, STR 11 = +0, AGL 16 = +4
ok("bonus 13", CNS5.attributeBonus(13), 1);
ok("bonus 12", CNS5.attributeBonus(12), 0);
ok("bonus 16", CNS5.attributeBonus(16), 4);
ok("bonus 19", CNS5.attributeBonus(19), 8);
ok("bonus 25", CNS5.attributeBonus(25), 15);
ok("bonus 2", CNS5.attributeBonus(2), -10);

// AR% spot checks (p103 and the sample NPC on p... STR 16 = 79%, CON 17 = 82%, AGL 19 = 88%)
ok("AR 16", CNS5.attributeRoll(16), 79);
ok("AR 17", CNS5.attributeRoll(17), 82);
ok("AR 19", CNS5.attributeRoll(19), 88);
ok("AR 12", CNS5.attributeRoll(12), 66);
ok("AR 11", CNS5.attributeRoll(11), 62);

// Crit die outcomes (p37)
ok("crit success 10", CNS5.critOutcome(10, true), "critical");
ok("crit success 8", CNS5.critOutcome(8, true), "competent");
ok("crit failure 10", CNS5.critOutcome(10, false), "abysmal");
ok("crit failure 5", CNS5.critOutcome(5, false), "disappointing");

/* -- The Absolute Strength Rating (p106) ------------------------------------ */

/* Three things follow from the rating: a bonus to Strength rolls, the damage
   bonus, and the tie-break in a contest of strength. */
const asrOf = (str, weight) =>
  Math.floor(Math.sqrt(5 + Math.floor((CNS5.liftingPercent(str) / 100) * weight)));

/* Devlin: Strength 14 at 150 lbs lifts 170 lbs, for an Absolute Strength of 13. */
ok("Devlin's lifting capacity", 5 + Math.floor((CNS5.liftingPercent(14) / 100) * 150), 170);
ok("and his Absolute Strength", asrOf(14, 150), 13);

/* Half the rating rounded up for medium and heavier weapons, a quarter rounded
   down for light ones. The two round opposite ways, which is easy to reverse. */
const damageBonus = (asr) => ({ medium: Math.ceil(asr / 2), light: Math.floor(asr / 4) });
ok("his damage bonus with a broadsword", damageBonus(13).medium, 7);
ok("and with a dagger", damageBonus(13).light, 3);
ok("a Knights Broadsword in his hands", 6 + damageBonus(13).medium + 1, 14);
ok("the heavier bonus rounds up", damageBonus(11).medium, 6);
ok("the lighter one rounds down", damageBonus(11).light, 2);
ok("an Absolute Strength of 1 still gives a heavier bonus", damageBonus(1).medium, 1);
ok("but no lighter one", damageBonus(1).light, 0);

/* The same rating is a bonus to Strength Attribute Rolls, which is why a
   Strength roll does not match the AR table on its own. */
const strAr = (str, weight) => Math.min(99, CNS5.attributeRoll(str) + asrOf(str, weight));
ok("the table alone would give", CNS5.attributeRoll(14), 73);
ok("Devlin's Strength roll", strAr(14, 150), 86);
ok("and it never passes 99", strAr(25, 400), 99);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
