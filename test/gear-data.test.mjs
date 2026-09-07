/**
 * Validate the extracted weapon and armour data.
 *
 * As with the skills data, correctness of the extraction itself was established
 * by cross-checking against the flat text layer: every weapon name and its
 * printed damage code appear on its cited page, and every armour entry's five
 * absorption values appear consecutively on one line of p260. These are the
 * structural checks on the result.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));

const raw = JSON.parse(await readFile(path.join(ROOT, "data", "gear.json"), "utf8"));
const { weapons, armour } = raw;

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* -- Weapons --------------------------------------------------------------- */

ok("weapon count matches header", weapons.length, raw.weaponCount);
ok("weapon count", weapons.length, 72);

ok("every weapon has a name", weapons.filter((w) => !w.name?.trim()).length, 0);

ok(
  "every weight class is one the Attacker's Bonus table knows",
  weapons.filter((w) => !CNS5.weaponWeights[w.weightClass]).map((w) => w.name),
  []
);

ok(
  "every damage type matches an armour absorption column",
  weapons.filter((w) => !CNS5.damageTypes[w.damageType]).map((w) => w.name),
  []
);

ok(
  "every role is known",
  weapons.filter((w) => !["melee", "launcher", "ammunition"].includes(w.role)).map((w) => w.name),
  []
);

/* A melee weapon always deals damage; a launcher never does, because the
   missile it looses carries it (p257). */
ok(
  "melee weapons deal damage",
  weapons.filter((w) => w.role === "melee" && !(w.baseDamage > 0)).map((w) => w.name),
  []
);

/* War Darts print a dash where their damage belongs and are not listed in the
   ranges table under that name, so the figure is nowhere to be had. */
ok(
  "ammunition without a damage figure",
  weapons.filter((w) => w.role === "ammunition" && !(w.baseDamage > 0)).map((w) => w.name),
  ["War Darts"]
);
ok(
  "launchers deal none themselves",
  weapons.filter((w) => w.role === "launcher" && w.baseDamage !== 0).map((w) => w.name),
  []
);

/* A thrown weapon is a melee weapon with ranges — a javelin deals its own
   damage and still benefits from the thrower's Strength — so having ranges does
   not make something a launcher. What must hold is that anything with ranges is
   flagged as a missile, and that a thrown melee weapon keeps its base damage. */
ok(
  "everything with ranges is flagged as a missile",
  weapons.filter((w) => w.ranges && !w.missile).map((w) => w.name),
  []
);
ok(
  "thrown melee weapons keep their own damage",
  weapons.filter((w) => w.ranges && w.role === "melee" && !(w.baseDamage > 0)).map((w) => w.name),
  []
);
ok(
  "the thrown melee weapons found",
  weapons.filter((w) => w.ranges && w.role === "melee").map((w) => w.name).sort(),
  ["Roman Pilum", "Throwing Knives", "War Javelin"]
);
ok(
  "range bands increase",
  weapons
    .filter((w) => w.ranges)
    .filter((w) => {
      const bands = ["short", "medium", "long", "extreme", "max"].map((b) => w.ranges[b]);
      return bands.some((v, i) => i > 0 && v < bands[i - 1]);
    })
    .map((w) => w.name),
  []
);

/* Every weapon cites the page it was read from. */
ok(
  "page references are within the weapon tables",
  weapons.filter((w) => ![255, 256, 257].includes(w.page)).map((w) => w.name),
  []
);

/* -- Armour ---------------------------------------------------------------- */

ok("armour count matches header", armour.length, raw.armourCount);
ok("armour count", armour.length, 27);

ok(
  "every armour weight class is known",
  armour.filter((a) => !CNS5.armourWeights[a.weightClass]).map((a) => a.name),
  []
);

ok(
  "every location is known",
  armour.filter((a) => !CNS5.armourLocations[a.location]).map((a) => a.name),
  []
);

ok(
  "every armour has all five absorption values",
  armour
    .filter((a) => Object.keys(CNS5.damageTypes).some((k) => !Number.isInteger(a.absorption[k])))
    .map((a) => a.name),
  []
);

/* Flesh is the zero baseline the table opens each section with. */
ok(
  "bare flesh absorbs nothing",
  armour.filter((a) => a.name === "Flesh").map((a) => Object.values(a.absorption).flat()),
  [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0]
  ]
);

/* Heavier armour is not uniformly better, but nothing in the table absorbs
   more than the jousting harness, which is what it was built for. */
const maxSlash = Math.max(...armour.map((a) => a.absorption.slash));
ok("the heaviest slash absorption", maxSlash, 25);

/* -- Armour pieces (pp.261-263) -------------------------------------------- */

const pieces = raw.armourPieces;

ok("piece count matches header", pieces.length, raw.armourPieceCount);
ok("piece count", pieces.length, 29);

/* Fatigue to wear is stored as a cost, so never negative. */
ok(
  "fatigue costs are positive magnitudes",
  pieces.filter((p) => p.fpToWear < 0).map((p) => p.name),
  []
);

/* Heavier armour is more tiring: nothing under 20 lbs costs more than 2 FP. */
ok(
  "light pieces are not exhausting",
  pieces.filter((p) => p.weight < 20 && p.fpToWear > 2).map((p) => p.name),
  []
);

ok(
  "every piece has a weight and a cost",
  pieces.filter((p) => !(p.weight > 0) || !(p.cost > 0)).map((p) => p.name),
  []
);

ok(
  "body pieces carry a weight modifier",
  pieces.filter((p) => p.location === "body" && !(p.weightModifier > 0)).map((p) => p.name),
  []
);

/* -- The armour weight rule (p261) ----------------------------------------- */

/* The worked example: Sir Miles weighs 210 lbs. His Maille has a base weight of
   36 lbs and a modifier of 6, and 210 is 36 lbs over 174, so the modifier is
   doubled and the suit weighs 48 lbs. His arming doublet is 8½ with a modifier
   of 1½, giving 11½.                                                          */
ok("Sir Miles's multiplier", CNS5.armourWeightMultiplier(210), 2);
ok("Sir Miles's maille", CNS5.armourWeightFor(36, 6, 210), 48);
ok("Sir Miles's arming doublet", CNS5.armourWeightFor(8.5, 1.5, 210), 11.5);

/* Inside the reference band nothing changes. */
ok("150 lbs is the bottom of the band", CNS5.armourWeightMultiplier(150), 0);
ok("174 lbs is the top of the band", CNS5.armourWeightMultiplier(174), 0);
ok("175 lbs is one step over", CNS5.armourWeightMultiplier(175), 1);
ok("199 lbs is still one step over", CNS5.armourWeightMultiplier(199), 1);
ok("200 lbs is two steps over", CNS5.armourWeightMultiplier(200), 2);

/* Below the band the rules name two cases. */
ok("120 lbs subtracts once", CNS5.armourWeightMultiplier(120), -1);
ok("99 lbs subtracts twice", CNS5.armourWeightMultiplier(99), -2);
/* 125-149 is unstated in the book; we fill it with a single subtraction. */
ok("140 lbs subtracts once", CNS5.armourWeightMultiplier(140), -1);

/* A light frame never drives a piece below nothing. */
ok("weight never goes negative", CNS5.armourWeightFor(1, 6, 80), 0);

/* No description text is carried. */
ok("no description text is shipped", "description" in weapons[0], false);

console.log(
  `\n${weapons.length} weapons (${weapons.filter((w) => w.ranges).length} with ranges), ` +
    `${armour.length} armour types, ${pieces.length} armour pieces`
);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
