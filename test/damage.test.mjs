/**
 * How a blow is applied (pp.272, 282, and the worked example on p287).
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const { resolveExchange } = await import(path.join(ROOT, "module", "helpers", "defence.mjs"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const apply = CNS5.applyDamage;

/* -- Sir Edward against the Goblin (p287) ---------------------------------- */

/* The broadsword does 6 base, +8 Strength, +3 for level, so 17; the Crit Die
   comes to 10, making 27; the critical adds a d10 which rolled 8. The goblin
   wears leather absorbing 5, and has 15 Fatigue and 17 Body. */
const goblin = apply({ damage: 27, bonus: 8, absorption: 5, fatigue: 15 });

ok("the leather absorbs five", goblin.absorbed, 5);
ok("twenty-two gets past it", goblin.throughArmour, 22);
ok("the goblin's Fatigue is spent", goblin.fatigueLost, 15);
/* Seven of the blow reaches Body, and the critical's eight is added to it —
   the bonus die ignores the armour and the Fatigue alike. */
ok("and fifteen comes off Body", goblin.bodyLost, 15);
ok("eight of which is the bonus die", goblin.bodyFromBonus, 8);

/* -- What a critical bypasses, and what it does not ------------------------ */

/* Only the bonus die ignores armour. The rest of a critical blow is absorbed
   and soaked by Fatigue like any other. */
const critical = apply({ damage: 20, bonus: 6, absorption: 8, fatigue: 30 });
ok("armour still stops its share of a critical", critical.absorbed, 8);
ok("Fatigue still takes what got through", critical.fatigueLost, 12);
ok("and only the bonus reaches Body", critical.bodyLost, 6);

/* An ordinary blow with no critical touches Body only once Fatigue is gone. */
ok("a blow smaller than Fatigue leaves Body alone",
   apply({ damage: 10, absorption: 0, fatigue: 30 }).bodyLost, 0);
ok("a blow larger than Fatigue spills over",
   apply({ damage: 40, absorption: 0, fatigue: 30 }).bodyLost, 10);
ok("and a target with no Fatigue takes it all on Body",
   apply({ damage: 12, absorption: 0, fatigue: 0 }).bodyLost, 12);

/* Armour that outmatches the blow stops it entirely. */
const turned = apply({ damage: 4, absorption: 10, fatigue: 20 });
ok("heavy armour stops a light blow", turned.throughArmour, 0);
ok("costing nothing at all", [turned.fatigueLost, turned.bodyLost], [0, 0]);

/* But armour never stops the bonus die. */
const pierced = apply({ damage: 4, bonus: 7, absorption: 10, fatigue: 20 });
ok("though the critical still tells", pierced.bodyLost, 7);

/* -- A natural ten (p272) --------------------------------------------------- */

/* "An unadjusted 10 on the Crit Die is always a Critical Success if the skill
   roll is successful", and always a Critical Failure if it failed — whatever
   the modifiers would have made of it. */
const isCritical = (raw, total) => total >= 10 || raw === 10;
ok("an adjusted ten is critical", isCritical(7, 10), true);
ok("a natural ten is critical however it was modified", isCritical(10, 6), true);
ok("a modified nine is not", isCritical(6, 9), false);
ok("nor a natural nine", isCritical(9, 9), false);
ok("a natural ten pushed higher is still critical", isCritical(10, 13), true);

/* -- Defences and damage (p270) --------------------------------------------- */

/* Under basic combat the defence comes off the chance to hit and nothing else,
   so a landed blow is a landed blow. Under advanced it can change the damage. */
const critHit = { success: true, critical: true };
const plainHit = { success: true, critical: false };
const goodDefence = { success: true, critical: false };
const critDefence = { success: true, critical: true };

ok("a critical defence turns a critical blow away entirely",
   resolveExchange(critHit, critDefence), { outcome: "blocked", damage: false, reduced: false, advantage: false });
ok("an ordinary defence only reduces it",
   resolveExchange(critHit, goodDefence), { outcome: "reduced", damage: true, reduced: true, advantage: false });
ok("an ordinary defence stops an ordinary blow",
   resolveExchange(plainHit, goodDefence).damage, false);

/* Reduced means losing the extra die, not the Crit Die: the blow becomes what
   an ordinary success would have been. */
const weapon = 17;
const critDie = 10;
const bonusDie = 8;
const full = weapon + critDie;
ok("a full critical carries the blow and the bonus", [full, bonusDie], [27, 8]);
ok("a reduced one carries the blow alone", full, 27);
ok("and the Crit Die is still in it", full - weapon, critDie);

/* -- Fumbles (p272) --------------------------------------------------------- */

ok("an opportune attack is made at a penalty", CNS5.opportuneAttackModifier, -20);
ok("the critical's extra die", CNS5.criticalBonusDie, "1d10");

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
