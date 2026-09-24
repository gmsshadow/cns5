/**
 * Character creation tables.
 *
 * The worksheet states four figures outright — the PC Point cost of an average
 * character at each of the three types, and the weight of the worked example —
 * so those are the anchors here.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFile } from "node:fs/promises";

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

/* -- Birth signs (pp.52-53) -------------------------------------------------- */

const signs = CNS5.birthSigns;
ok("twelve signs", Object.keys(signs).length, 12);
ok("each favours two categories",
   Object.values(signs).filter((s) => s.categories.length !== 2).length, 0);
ok("and one attribute",
   Object.values(signs).filter((s) => !s.attribute).length, 0);

/* The table's categories must be ones our skill list actually uses, or a sign
   would favour nothing: the book writes "Thievery" where the list says
   Thievish, and "Outdoor" where it says Outdoor. */
const skillList = JSON.parse(await readFile(path.join(ROOT, "data", "skills.json"), "utf8")).skills;
const realCategories = new Set(skillList.map((s) => s.category));
ok("every favoured category is a real one",
   [...new Set(Object.values(signs).flatMap((s) => s.categories))].filter((c) => !realCategories.has(c)),
   []);

/* Every face of the d100 gives a sign or the right to choose one. */
const signFaces = Array(101).fill(0);
for (const s of Object.values(signs)) for (let v = s.roll[0]; v <= s.roll[1]; v++) signFaces[v]++;
for (let v = CNS5.selectSignRoll[0]; v <= CNS5.selectSignRoll[1]; v++) signFaces[v]++;
ok("no gap in the d100", signFaces.map((n, v) => (v && !n ? v : null)).filter(Boolean), []);
ok("and no overlap", signFaces.map((n, v) => (n > 1 ? v : null)).filter(Boolean), []);

ok("a roll of 1 is Aries", CNS5.birthSignFor(1), "aries");
ok("40 is Leo", CNS5.birthSignFor(40), "leo");
ok("96 is Pisces", CNS5.birthSignFor(96), "pisces");
ok("97 lets the player choose", CNS5.birthSignFor(97), null);
ok("which costs ten points", CNS5.selectSignCost, 10);

/* "A well aspected or Neutral character has the choice of either two skills
   from one favoured category or one skill from each... A poorly aspected
   character may only choose a single skill." */
ok("favoured skills by aspect",
   ["well", "neutral", "poor"].map((a) => CNS5.sunsignSkills[a]), [2, 2, 1]);

/* "Mastered at +20 PSF% and +2 Levels... If it is not a vocational skill they
   gain +10 PSF% and +2 levels." The skill already carries both halves as
   mastered and sunsign, ten apiece. */
ok("a vocational favoured skill", CNS5.sunsignPsf.vocational, 20);
ok("any other", CNS5.sunsignPsf.other, 10);
ok("and two levels either way", CNS5.sunsignLevels, 2);

/* The experience bonuses run the other way for magick: a neutrally aspected
   mage gains nothing where a poorly aspected one gains ten (p53). */
ok("ordinary skills", CNS5.sunsignExperience.ordinary, { well: 15, neutral: 10, poor: 5 });
ok("magick", CNS5.sunsignExperience.magick, { well: 15, neutral: 0, poor: 10 });
ok("and priestly magick only when neutral",
   CNS5.sunsignExperience.priestly, { well: 0, neutral: 10, poor: 0 });

/* Table - Birth Omens (p54). */
const omenFaces = Array(101).fill(0);
for (const o of Object.values(CNS5.birthOmenTable)) for (let v = o.roll[0]; v <= o.roll[1]; v++) omenFaces[v]++;
ok("the omens cover the d100", omenFaces.map((n, v) => (v && !n ? v : null)).filter(Boolean), []);
ok("well omens cost ten points to choose", CNS5.birthOmenTable.well.pcPoints, -10);
ok("poor omens give ten", CNS5.birthOmenTable.poor.pcPoints, 10);
ok("and the favoured attribute is rolled with the best or worst of the extra dice",
   ["well", "neutral", "poor"].map((a) => CNS5.birthOmenTable[a].favouredAttribute),
   ["best", null, "worst"]);

/* -- Experience Level (p45) -------------------------------------------------- */

ok("twenty printed levels", CNS5.experienceLevelFloors.length, 20);
ok("the first begins at nothing", CNS5.experienceLevelFloors[0], 0);
ok("the second at 5,001", CNS5.experienceLevelFloors[1], 5_001);
ok("the twentieth at 330,001", CNS5.experienceLevelFloors[19], 330_001);
ok("and the floors only rise",
   CNS5.experienceLevelFloors.filter((v, i) => i && v <= CNS5.experienceLevelFloors[i - 1]), []);

const exl = CNS5.experienceLevel;
ok("nothing is level one", exl(0), 1);
ok("5,000 is still level one", exl(5_000), 1);
ok("5,001 is level two", exl(5_001), 2);
ok("95,000 is level ten", exl(95_000), 10);
ok("95,001 is eleven", exl(95_001), 11);

/* "From Level 20 onwards each Experience Level costs +30,000 Exp." */
ok("beyond twenty, thirty thousand a level", CNS5.experienceBeyondTwenty, 30_000);
ok("330,001 is twenty", exl(330_001), 20);
ok("360,001 is twenty-one", exl(360_001), 21);
ok("390,001 is twenty-two", exl(390_001), 22);

const progress = CNS5.experienceProgress(5_000);
ok("one point short of the second level", progress.needed, 1);
ok("which begins at", progress.next, 5_001);

/* -- Acts of Faith, from their descriptions (pp.441-454) --------------------- */

const faith = JSON.parse(await readFile(path.join(ROOT, "data", "acts-of-faith.json"), "utf8")).acts;

ok("acts in all", faith.length, 48);
ok("all but two described", faith.filter((a) => !a.described).map((a) => a.name),
   ["Prayer for Strength of the Holy", "Greater Miracle"]);

/* "SC: Success Chance that the benefit flows to the recipient" — a formula
   against the supplicant or the recipient, not a number, so it is kept as
   written (p404). */
const described = faith.filter((a) => a.described);
ok("most have a success chance", described.filter((a) => a.successChanceText).length, 36);
ok("and nearly all a cost", described.filter((a) => a.costText).length >= 40, true);

/* "Auto: Automatically takes effect (i.e. no Spirit AR% roll, etc. is
   required)" — the Sacraments, which always succeed. An Act cannot both always
   work and have a chance of working. */
const automatic = faith.filter((a) => a.automatic);
ok("acts that always take effect", automatic.length, 10);
ok("none of which has a success chance", automatic.filter((a) => a.successChanceText).map((a) => a.name), []);

/* The marks on a name: "† solely within the competence of ordained priests",
   "‡ ordained Priests, Monastics... and Holy Fighting Orders" (p404). */
ok("ordained only", faith.filter((a) => a.ordainedOnly).length, 27);
ok("and the wider reservation", faith.filter((a) => a.monasticOnly).length, 7);
ok("no act is marked both",
   faith.filter((a) => a.ordainedOnly && a.monasticOnly).map((a) => a.name), []);

/* The book disagrees with itself over two Acts: the vocation tables on p146
   against the descriptions on pp.453-454. Both figures are carried and the
   fuller entry is used. */
const disputed = faith.filter((a) => a.pffInDescription !== undefined);
ok("the two the book gives twice", disputed.map((a) => a.name).sort(), ["Baptism", "Ordination"]);
ok("Baptism: table 20, description 15",
   [faith.find((a) => a.name === "Baptism").pffMinimum, faith.find((a) => a.name === "Baptism").pffInDescription],
   [20, 15]);

/* No Act is gated below the lowest Personal Faith Factor a believer can have. */
ok("every act has a PFF minimum", described.filter((a) => a.pffMinimum === undefined).length, 0);

/* The descriptions are the rulebook's and are not shipped. */
ok("no description text", faith.filter((a) => "text" in a || "description" in a).length, 0);

/* -- Step 6: legitimacy and sibling rank (pp.82-83) ------------------------ */

const legit = (roll) => CNS5.readRoll(CNS5.legitimacy, roll).key;
ok("01-03 unrecognised", [1, 3].map(legit), ["unrecognised", "unrecognised"]);
ok("04-10 a bastard", [4, 10].map(legit), ["bastard", "bastard"]);
ok("and the rest legitimate", [11, 100].map(legit), ["legitimate", "legitimate"]);
ok("a slave's child rolls at -65", CNS5.slaveLegitimacyPenalty, -65);

/* The PC Points here are gained — an unrecognised bastard is compensated —
   where the Sibling Rank table beside them prints a price. */
ok("an unrecognised bastard gains five", CNS5.legitimacy[0].pcGained, 5);
ok("the eldest costs three to buy", CNS5.siblingRankCost[1], 3);
ok("the youngest gives two back", CNS5.siblingRankCost[5], -2);
ok("and the youngest of five is the default", CNS5.defaultSiblingRank, 5);

/* "Roll ½D10 (round down)." A one gives nought, read as the eldest. */
ok("sibling rank by the d10",
   [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(CNS5.siblingRankFor), [1, 1, 1, 2, 2, 3, 3, 4, 4, 5]);

/* -- Step 7: status in one's own family (p84) -------------------------------- */

const status = (roll) => CNS5.readRoll(CNS5.familyStatus, roll).key;
ok("01-15 a Black Sheep", [1, 15].map(status), ["blackSheep", "blackSheep"]);
ok("16-85 a credit", [16, 85].map(status), ["credit", "credit"]);
ok("86-100 a favourite", [86, 100].map(status), ["goodChild", "goodChild"]);
ok("an heir adds twenty-one", CNS5.heirFamilyBonus, 21);
ok("and may roll past a hundred", status(80 + CNS5.heirFamilyBonus), "goodChild");
ok("a Black Sheep is compensated", CNS5.familyStatus[0].pcGained, 5);
ok("a favourite pays", CNS5.familyStatus[2].pcGained, -5);

/* -- Steps 8-10 (pp.84-94) ------------------------------------------------- */

ok("only the poorly aspected must roll a curse", CNS5.curseRequiredFor, ["poor"]);
ok("a voluntary one is worth five", CNS5.voluntaryCursePoints, 5);
ok("up to three talents may be bought", CNS5.talentsBoughtMaximum, 3);
ok("flaws chosen for points may come to twenty-five", CNS5.flawPointsMaximum, 25);

/* The wizard steps now follow the book's own numbering. */
const wizard = await readFile(path.join(ROOT, "module", "apps", "creation-wizard.mjs"), "utf8");
const numbers = [...wizard.matchAll(/number: "([^"]+)"/g)].map((m) => m[1]);
ok("the wizard's steps", numbers, ["1", "2", "3", "4", "5", "6-7", "8-10", "11", "12", "18", "13-17, 19"]);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
