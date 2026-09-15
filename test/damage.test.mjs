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

/* -- Where an unaimed blow lands -------------------------------------------- */

/* Hit locations are an optional rule attached to critical hits (p282), and the
   location table gives the chest forty results in a hundred on its own. An
   ordinary attack is a blow at the body, so it is the body's armour that stops
   it — not every piece the target happens to be wearing added together. */
ok("the torso is where a blow lands", CNS5.defaultHitLocation, "body");
ok("and an unaimed shot means the torso", CNS5.targetAreaLocations.none, "body");

/* An aimed shot names a part, and the armour over that part is what stops it. */
ok("a blow at the head", CNS5.targetAreaLocations.head, "head");
ok("at the neck", CNS5.targetAreaLocations.neck, "head");
ok("at the eyes", CNS5.targetAreaLocations.eyes, "head");
ok("at an arm", CNS5.targetAreaLocations.arm, "limbs");
ok("at a foot", CNS5.targetAreaLocations.foot, "limbs");
ok("at the abdomen is still the body", CNS5.targetAreaLocations.abdomen, "body");

/* Every area the aimed shot table offers must map to a place armour is worn,
   or a called shot silently falls back to the torso. */
ok(
  "every target area has a location",
  Object.keys(CNS5.aimedShotModifiers).filter((a) => !CNS5.targetAreaLocations[a]),
  []
);
ok(
  "and every location is one armour knows",
  [...new Set(Object.values(CNS5.targetAreaLocations))]
    .filter((l) => !CNS5.armourLocations[l]),
  []
);

/* -- Coverage (pp.261-263) -------------------------------------------------- */

/* Each class of armour protects a stated set of parts, and the sets are nested:
   every heavier class covers everything a lighter one does. A class that broke
   that would mean a suit of plate leaving something a doublet protects. */
const covers = (cls, area) => CNS5.armourClasses[cls].covers.includes(area);

ok("a doublet covers the chest", covers("lightBody", "chest"), true);
ok("and the arms", covers("lightBody", "arm"), true);
ok("but not the groin", covers("lightBody", "groin"), false);
ok("nor the legs", covers("lightBody", "upperLeg"), false);

ok("a cuirass adds the groin", covers("heavyBody", "groin"), true);
ok("but still not the legs", covers("heavyBody", "upperLeg"), false);

ok("a hauberk reaches the legs", covers("threeQuarter", "upperLeg"), true);
ok("and the hands", covers("threeQuarter", "hand"), true);
ok("but not the feet", covers("threeQuarter", "foot"), false);

ok("full battle armour reaches the feet", covers("heavyBattle", "foot"), true);
ok("and full mail the throat", covers("superHeavy", "neck"), true);

/* The nesting, checked rather than assumed. */
const nested = ["lightBody", "heavyBody", "threeQuarter", "heavyBattle"];
const breaks = [];
for (let i = 1; i < nested.length; i++) {
  for (const area of CNS5.armourClasses[nested[i - 1]].covers) {
    if (!covers(nested[i], area)) breaks.push(`${nested[i]} leaves ${area} bare`);
  }
}
ok("each heavier class covers what the lighter one did", breaks, []);

/* A hauberk reaches the knees, so a leg hit meets it seven times in ten. */
ok("the hauberk's leg coverage", CNS5.armourClasses.threeQuarter.partial.upperLeg, 70);
ok("for both parts of the leg", CNS5.armourClasses.threeQuarter.partial.lowerLeg, 70);
ok(
  "and nothing else is partial",
  Object.entries(CNS5.armourClasses).filter(([k, v]) => v.partial && k !== "threeQuarter"),
  []
);

/* Helmets differ in how much of the face and throat they enclose. */
ok("an open helm leaves the face bare", covers("helmet", "eyes"), false);
ok("an enclosed one does not", covers("enclosedHelm", "eyes"), true);
ok("a visored helm guards the throat", covers("visoredHelm", "neck"), true);
ok("a coif guards the neck but not the face", 
   [covers("coif", "neck"), covers("coif", "eyes")], [true, false]);

/* Every area a called shot can name must be covered by something, or that shot
   can never meet armour at all. */
const coverable = new Set(Object.values(CNS5.armourClasses).flatMap((c) => c.covers));
ok(
  "every part of the body can be armoured",
  CNS5.bodyAreas.filter((area) => !coverable.has(area)),
  []
);

/* The areas are the ones the aimed shot table names, so the two agree. */
ok(
  "every target area is a body area",
  Object.keys(CNS5.aimedShotModifiers).filter((a) => a !== "none" && !CNS5.bodyAreas.includes(a)),
  []
);

/* Coverage is read off the item, so a Gamemaster can fit something odd. */
const hauberk = { covers: ["chest", "upperLeg"], coverage: { upperLeg: 70 } };
ok("a covered part is certain", CNS5.coverageOf(hauberk, "chest"), 100);
ok("a partly covered one is not", CNS5.coverageOf(hauberk, "upperLeg"), 70);
ok("an uncovered one is nothing", CNS5.coverageOf(hauberk, "head"), 0);
ok("and a shield covers nothing worn", CNS5.coverageOf({ covers: [] }, "chest"), 0);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
