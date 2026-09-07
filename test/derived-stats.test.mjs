import { CNS5 } from "../module/config.mjs";
const ok = (label, got, want) =>
  console.log(`${got === want ? "PASS" : "FAIL"}  ${label}: got ${got}, want ${want}`);

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
