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

/* -- What modifies the Crit Die ---------------------------------------------- */

/* Three things do on a shot, and only one on a blow. Every bow in the table has
   a Crit Die modifier of nothing — the head does the work — so taking the
   launcher's figure and ignoring the arrow's lost every missile between one and
   two on the die. */
const { resolveShot } = await import(path.join(ROOT, "module", "helpers", "missiles.mjs"));

const gear = JSON.parse(await readFile(path.join(ROOT, "data", "gear.json"), "utf8")).weapons;
const named = (name) => gear.find((w) => w.name === name);

ok("no bow modifies the die", 
   ["Short Bow", "Composite Bow", "Longbow", "Elvish Longbow"]
     .map((n) => named(n).critDieModifier)
     .filter((v) => v !== 0),
   []);
ok("nor any crossbow",
   ["Light Crossbow", "Medium Crossbow", "Heavy Crossbow"]
     .map((n) => named(n).critDieModifier)
     .filter((v) => v !== 0),
   []);

/* The arrows and bolts do. */
ok("hunting arrows", named("Hunting Arrows").critDieModifier, 2);
ok("war arrows", named("War Arrows").critDieModifier, 2);
ok("a heavy crossbow bolt", named("Heavy Crossbow Bolts").critDieModifier, 2);
ok("a lead bullet", named("Lead Bullets").critDieModifier, 2);
ok("a hunting bolt does not", named("Hunting Bolts").critDieModifier, 0);

/* Melee weapons carry their own. */
ok("a broadsword", named("Knights Broadsword").critDieModifier, 1);
ok("a halberd", named("Halberd").critDieModifier, 2);
ok("a dagger does not", named("Dagger").critDieModifier, 0);

/* Edward again, with the arrow counted this time: the bracket takes four, his
   arm gives three back, and the war arrow two more. */
const shot = resolveShot({
  profile: find("Longbow", "War Arrow"),
  band: "medium",
  strength: 15,
  ammunition: "War Arrows",
  ammunitionCrit: named("War Arrows").critDieModifier,
  strengthModifiers
});
ok("the bracket", shot.rangeCrit, -4);
ok("his strength", shot.strengthCrit, 3);
ok("the arrow", shot.ammunitionCrit, 2);
ok("and the three together", shot.critMod, 1);

/* A weak archer with the same bow and arrows fares worse, and the difference is
   exactly the strength row. */
const weak = resolveShot({
  profile: find("Longbow", "War Arrow"),
  band: "medium",
  strength: 10,
  ammunition: "War Arrows",
  ammunitionCrit: 2,
  strengthModifiers
});
ok("a weak arm gains nothing from strength", weak.strengthCrit, 0);
ok("but still gains the arrow", weak.critMod, -2);
ok("so strength is worth three here", shot.critMod - weak.critMod, 3);

/* -- What a bracket shows ---------------------------------------------------- */

/* A bracket is printed in the book and then lengthened by a strong arm. Adding
   the two silently gave a short bow a maximum range of 700 feet, which appears
   nowhere in the rulebook and cannot be checked against it, so the two are
   shown apart. */
const shortBow = find("Short Bow", "Hunting Arrows");
ok("the printed brackets", CNS5.rangeBands.map((b) => shortBow.ranges[b]), [20, 30, 90, 150, 500]);

const reach = (strength, band) =>
  shortBow.ranges[band] + CNS5.rangedStrengthBonus(strength, band);
ok("a weak arm reaches what is printed",
   CNS5.rangeBands.map((b) => reach(11, b)), [20, 30, 90, 150, 500]);
ok("Strength 16 reaches further at the far brackets",
   CNS5.rangeBands.map((b) => reach(16, b)), [20, 30, 90, 350, 700]);
ok("but not at the near ones", reach(16, "short"), shortBow.ranges.short);

/* The extension is the difference, and it is the same at both far brackets. */
ok("four points over twelve is two hundred feet",
   reach(16, "extreme") - shortBow.ranges.extreme, 200);
ok("the same at maximum", reach(16, "max") - shortBow.ranges.max, 200);

/* -- Brackets follow the loading -------------------------------------------- */

/* The ranges belong to the pairing, so changing the arrow changes the
   distances as well as the damage. Listing the first loading's brackets and
   leaving them there meant choosing different arrows changed everything except
   how far they went. */
const loadings = ["Hunting Arrows", "War Arrow", "AP Arrow"].map((a) => find("Short Bow", a));
ok("a short bow's maximum by arrow", loadings.map((p) => p.ranges.max), [500, 400, 180]);
ok("and its long range", loadings.map((p) => p.ranges.long), [90, 60, 40]);
ok(
  "no two loadings of a bow share their brackets",
  new Set(loadings.map((p) => CNS5.rangeBands.map((b) => p.ranges[b]).join("/"))).size,
  3
);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
