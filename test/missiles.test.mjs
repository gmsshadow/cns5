/**
 * Missile attacks (pp.257-258).
 *
 * Table - Missile Ranges is a table of pairings, not of weapons. A bow's damage,
 * reach and Crit Die modifier all belong to the bow and its arrows together, and
 * none of the three can be read off the bow alone.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const data = JSON.parse(await readFile(path.join(ROOT, "data", "missiles.json"), "utf8"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const { profiles, strengthModifiers } = data;
const find = (weapon, ammo) =>
  profiles.find((p) => p.weapon === weapon && (ammo ? p.ammunition === ammo : true));

ok("profile count", profiles.length, 25);

/* -- The bow and the arrow together ----------------------------------------- */

/* The same bow with different arrows is a different weapon: the damage rises
   and the reach falls as the arrow gets heavier. */
const longbow = ["Hunting Arrows", "War Arrow", "AP Arrow"].map((a) => find("Longbow", a));
ok("a longbow's damage by arrow", longbow.map((p) => p.baseDamage), [14, 15, 17]);
ok("and its reach at maximum", longbow.map((p) => p.ranges.max), [800, 600, 450]);

/* The composite base damage is the bow's bonus plus the arrow's, which is what
   makes it a pairing rather than a property of either. Hunting arrows do 9, so
   a longbow's +5 gives 14. */
ok("a short bow adds nothing", find("Short Bow", "Hunting Arrows").baseDamage, 9);
ok("a composite bow adds three", find("Composite. Bow", "Hunting Arrows").baseDamage, 12);
ok("a longbow adds five", find("Longbow", "Hunting Arrows").baseDamage, 14);

/* Thrown weapons are their own ammunition. */
const thrown = profiles.filter((p) => p.thrown);
ok("what is thrown", thrown.map((p) => p.weapon).sort(), [
  "Dart", "Hunting Javelin", "Pilum", "Thrown Axe", "Thrown Knife", "War Javelin"
]);
ok("and carries no ammunition", thrown.filter((p) => p.ammunition).length, 0);

/* Every launcher has at least one loading, or it cannot be shot at all. */
const launchers = [...new Set(profiles.filter((p) => !p.thrown).map((p) => p.weapon))];
ok("launchers found", launchers.length, 9);
ok(
  "every launcher is loaded with something",
  profiles.filter((p) => !p.thrown && !p.ammunition).map((p) => p.weapon),
  []
);

/* Ranges only ever lengthen across the brackets. */
ok(
  "every profile's brackets increase",
  profiles
    .filter((p) => {
      const reach = CNS5.rangeBands.map((b) => p.ranges[b]);
      return reach.some((v, i) => i > 0 && v < reach[i - 1]);
    })
    .map((p) => `${p.weapon} / ${p.ammunition ?? "itself"}`),
  []
);

/* -- Strength at a distance (p258) ------------------------------------------ */

ok("strength tells from twelve", CNS5.rangedStrengthMinimum, 12);
ok("and adds fifty feet a point", CNS5.rangedStrengthRangePerPoint, 50);
ok("but only at the far brackets", CNS5.rangedStrengthRangeBands, ["extreme", "max"]);

ok("a weak arm gains no reach", CNS5.rangedStrengthBonus(11, "extreme"), 0);
ok("nor one of exactly twelve", CNS5.rangedStrengthBonus(12, "extreme"), 0);
ok("Strength 15 reaches 150 feet further", CNS5.rangedStrengthBonus(15, "extreme"), 150);
ok("at maximum too", CNS5.rangedStrengthBonus(15, "max"), 150);
ok("but not at long range", CNS5.rangedStrengthBonus(15, "long"), 0);

/* The book's worked example: "Edward has STR 15 and armed with a Longbow using
   War Arrows. His Crit Die Modifier at Medium range is -1 instead of -4 due to
   the strength modifier." */
const edward = find("Longbow", "War Arrow");
const warArrows = strengthModifiers.find((s) => s.ammunition === "War Arrows");
ok("the bracket costs Edward four", edward.critModifiers.medium, -4);
ok("his strength gives back three", warArrows.modifiers.medium, 3);
ok("leaving one", edward.critModifiers.medium + warArrows.modifiers.medium, -1);

/* Every kind of missile must find a row of the strength table, or a strong
   archer silently gains nothing. */
const rows = new Set(strengthModifiers.map((s) => s.ammunition));
const unmatched = profiles
  .map((p) => CNS5.rangedStrengthRow(p.ammunition ?? p.weapon))
  .filter((row) => !rows.has(row));
ok("every missile finds a strength row", [...new Set(unmatched)], []);

/* Crossbows gain nothing from a strong arm — the windlass does the work. */
ok(
  "a crossbow is indifferent to strength",
  ["Lt X-Bowbolts", "Mdm X-Bowbolts", "Hvy X-Bowbolts"]
    .map((n) => Object.values(strengthModifiers.find((s) => s.ammunition === n).modifiers))
    .flat()
    .filter((v) => v !== 0),
  []
);

/* -- Matching ammunition to launchers --------------------------------------- */

ok("an arrow is an arrow", CNS5.ammunitionKindOf("War Arrows"), "arrow");
ok("a bolt is a bolt", CNS5.ammunitionKindOf("Heavy Crossbow Bolts"), "bolt");
ok("a hunting bolt too", CNS5.ammunitionKindOf("Hunting Bolts"), "bolt");
ok("a bullet is shot from a sling", CNS5.ammunitionKindOf("Lead Bullets"), "stone");
ok("a bow shoots arrows", CNS5.ammunitionKindOf("Longbow"), "");

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
