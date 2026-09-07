/**
 * Character creation tables.
 *
 * The worksheet states four figures outright — the PC Point cost of an average
 * character at each of the three types, and the weight of the worked example —
 * so those are the anchors here.
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

const NINE = 9; // the rolled attributes; the other three are averages

/* -- Attribute costs (worksheet header, p103) ------------------------------ */

ok("Historical average of 11 costs 99", NINE * CNS5.attributeCost(11), 99);
ok("Heroic average of 13 costs 117", NINE * CNS5.attributeCost(13), 117);
ok("Mythic average of 16 costs 153", NINE * CNS5.attributeCost(16), 153);

ok("a point a level up to 15", CNS5.attributeCost(15), 15);
ok("two a level after that", CNS5.attributeCost(16), 17);
ok("and it keeps costing two", CNS5.attributeCost(20), 25);
ok("the human minimum", CNS5.attributeMinimum, 2);

/* Budgets are large enough for an average character of their type but not
   lavishly so — that is what makes the design method a real choice. */
for (const [type, average] of [["historical", 11], ["heroic", 13], ["mythic", 16]]) {
  const spend = NINE * CNS5.attributeCost(average);
  ok(`${type} budget covers its average character`, CNS5.pcBudget[type] >= spend, true);
}

/* -- Height, build and weight (pp.104-106) --------------------------------- */

/* The worked example: a Historical human male rolls 12 on the height dice,
   adds his +57 modifier for 69 inches; a build die of 5 plus his +1 modifier
   gives Build Factor 6, worth +5%; 69 inches is a basic 155 lbs, so 163.     */
const male = CNS5.heightAndBuild.historical.male;
ok("the example's height modifier", male.heightMod, 57);
ok("12 on the dice gives 69 inches", 12 + male.heightMod, 69);
ok("a build die of 5 gives Build Factor 6", 5 + male.buildMod, 6);
ok("69 inches and Build 6 weighs 163", CNS5.weightFor(69, 6), 163);

/* The second example: the same 155 lbs less 5% for a Build Factor of 4. */
ok("Build 4 takes 5% off", CNS5.weightFor(69, 4), 148);

ok("Build 5 is the neutral band", CNS5.weightFor(69, 5), 155);
ok("a very light frame", CNS5.weightFor(69, 1), 117);
ok("a massive frame", CNS5.weightFor(69, 13), 217);

/* Agility lightens the build, Constitution thickens it (p105). */
ok("nimble and hale cancel out", CNS5.buildAdjustment(16, 16), 0);
ok("very nimble", CNS5.buildAdjustment(20, 10), -2);
ok("very hale", CNS5.buildAdjustment(10, 20), 2);
ok("neither applies below 15", CNS5.buildAdjustment(14, 14), 0);

/* Every type and gender has a full set of size figures. */
const missingSizes = [];
for (const [type, byGender] of Object.entries(CNS5.heightAndBuild)) {
  for (const [gender, row] of Object.entries(byGender)) {
    for (const field of ["heightMod", "defaultHeight", "buildMod", "defaultBuild"]) {
      if (!Number.isFinite(row[field])) missingSizes.push(`${type}.${gender}.${field}`);
    }
  }
}
ok("every type and gender has size figures", missingSizes, []);

/* -- Starting age (p114) --------------------------------------------------- */

const band = (roll) => CNS5.startingAge.find((b) => roll <= b.max);
ok("a roll of 1 gives the youngest band", band(1).human, 13);
ok("the default band is eighteen", band(50).human, 18);
ok("the default band gives 5,000 experience", band(50).exp, 5000);
ok("the default band is free", band(50).cost, 0);
ok("a roll of 100 gives the oldest band", band(100).human, 25);
ok("the oldest band gives 8,500 experience", band(100).exp, 8500);
ok("the default band is the one the worksheet names", CNS5.defaultAgeBand.human, 18);

/* Experience rises with age, and the point cost falls as it does. */
const ages = CNS5.startingAge;
ok("experience only rises",
   ages.filter((b, i) => i > 0 && b.exp <= ages[i - 1].exp).map((b) => b.max), []);
ok("cost only falls",
   ages.filter((b, i) => i > 0 && b.cost >= ages[i - 1].cost).map((b) => b.max), []);
ok("the bands run to 100", ages.at(-1).max, 100);

/* -- Innate modifiers (p103) ----------------------------------------------- */

ok("a roll of 1 or 2 gives nothing", CNS5.innateModifiers[0].magnitude, 0);
ok("and costs nothing", CNS5.innateModifiers[0].cost, 0);
ok("the largest modifier", CNS5.innateModifiers.at(-1).magnitude, 4);
ok("and what it costs", CNS5.innateModifiers.at(-1).cost, 8);
ok("cost rises faster than magnitude",
   CNS5.innateModifiers.map((r) => r.cost), [0, 1, 3, 5, 8]);

/* -- Roll bonuses (p103) --------------------------------------------------- */

ok("Historical rolls straight", CNS5.typeRollBonus.historical, 0);
ok("Heroic adds two", CNS5.typeRollBonus.heroic, 2);
ok("Mythic adds five", CNS5.typeRollBonus.mythic, 5);

/* Only the design method carries a budget. */
ok("methods that roll",
   Object.entries(CNS5.creationMethods).filter(([, m]) => m.rolls).map(([k]) => k),
   ["random", "lionHeart"]);
ok("methods with a budget",
   Object.entries(CNS5.creationMethods).filter(([, m]) => m.budget).map(([k]) => k),
   ["design"]);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
