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
ok("weapon count", weapons.length, 71);

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

/* No description text is carried. */
ok("no description text is shipped", "description" in weapons[0], false);

console.log(
  `\n${weapons.length} weapons, ${armour.length} armour entries, ` +
    `${weapons.filter((w) => w.ranges).length} with ranges`
);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
