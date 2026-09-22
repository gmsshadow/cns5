/**
 * Targeting a spell (pp.296-298).
 *
 * Casting a spell and targeting it are separate acts. These are the modifiers
 * that bear on the second.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const { resolveTargeting, intrinsicResistance } = await import(
  path.join(ROOT, "module", "helpers", "targeting.mjs")
);
const tables = JSON.parse(await readFile(path.join(ROOT, "data", "magick.json"), "utf8"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const { targetResistance, movement, obstacles } = tables;

/* -- What a target resists by (p297) ----------------------------------------- */

ok("kinds of target", Object.keys(targetResistance).length, 22);
ok("a man resists nothing", targetResistance.Human, 0);
ok("a wood elf a little", targetResistance["Wood Elf"], 10);
ok("a clan dwarf more", targetResistance["Dwarf, Clan"], 20);
ok("a noble dwarf more again", targetResistance["Dwarf, Noble"], 25);
ok("a lich most of all", targetResistance.Lich, 40);
ok("a spectre nearly as much", targetResistance["Spectre, Phantom"], 30);

/* A large animal resists nothing while a small one resists a great deal, which
   reads oddly until you consider what a spell has to find. */
ok("a large animal", targetResistance["Large Animal"], 0);
ok("a small one", targetResistance["Small Animal"], 25);
ok("and a thing that does not think", targetResistance["Non-sentient"], 0);

/* Matching is by what the target is, most particular answer first — otherwise
   a Wood Elf would be read as an Elf and resist the wrong amount. */
const of = (race) => intrinsicResistance({ system: { details: { race } } }, targetResistance);
ok("a wood elf is not a true elf", of("Wood Elf").value, 10);
ok("a true elf is not a wood elf", of("True Elf").value, 20);
ok("a noble dwarf is not a clan dwarf", of("Dwarf, Noble").value, 25);
ok("something unlisted resists nothing", of("Goblin").value, 0);
ok("and is honest about not knowing", of("Goblin").matched, null);
ok("nothing at all resists nothing", of("").value, 0);

/* -- Movement (p297) --------------------------------------------------------- */

const move = (id) => movement.find((m) => m.id === id)?.modifier;
ok("a caster on the move is hampered", move("casterMoving"), -10);
ok("a target standing still is easier", move("targetStill"), 10);
ok("one moving is harder", move("targetMoving30"), -5);
ok("one running harder still", move("targetMoving100"), -15);
ok("and one charging you is easiest of all", move("targetAdvancing"), 10);
ok("five entries", movement.length, 5);

/* -- Obstacles (p298) -------------------------------------------------------- */

const block = (id) => obstacles.find((o) => o.id === id);
ok("ten entries", obstacles.length, 10);
ok("foliage", block("foliage").modifier, -10);
ok("fog or fire", block("dust").modifier, -15);
ok("water or rock", block("water").modifier, -20);
ok("lead", block("lead").modifier, -25);
ok("invisibility", block("invisible").modifier, -25);

/* True Lead is not a penalty but a wall, and must not be treated as a number. */
ok("True Lead stops a spell outright", block("trueLead").impenetrable, true);
ok("and carries no modifier to add", block("trueLead").modifier, null);
ok("nothing else is impenetrable", obstacles.filter((o) => o.impenetrable).length, 1);

/* -- Putting it together ------------------------------------------------------ */

const shot = (options) => resolveTargeting({ tables, ...options });

ok("an unobstructed spell at short range is the caster's own chance",
   shot({ methodTsc: 72 }).total, 72);
ok("a clan dwarf takes twenty off it",
   shot({ methodTsc: 72, resistance: 20 }).total, 52);
ok("long range ten more", shot({ methodTsc: 72, resistance: 20, range: "long" }).total, 42);
ok("foliage ten more again",
   shot({ methodTsc: 72, resistance: 20, range: "long", obstacles: ["foliage"] }).total, 32);

/* A willing target is worth more than everything else put together. */
ok("a willing target", CNS5.willingTargetBonus, 50);
ok("which is decisive", shot({ methodTsc: 30, resistance: 20, willing: true }).total, 60);

/* A dodge comes off as the dodger's skill, not as a flat figure. */
ok("a dodge of 24", shot({ methodTsc: 72, dodgePsf: 24 }).total, 48);
ok("the minimum distance to attempt one", CNS5.spellDodgeMinimumDistance, 50);

/* The Shadow World is both a high mana place and a help in itself. */
ok("its bonus", shot({ methodTsc: 72, manaBonus: 10 }).total, 82);

/* True Lead is reported rather than added. */
const walled = shot({ methodTsc: 90, obstacles: ["trueLead"] });
ok("a walled spell is marked", walled.impenetrable, true);
ok("and says what stopped it", walled.impenetrableBy.includes("True Lead"), true);

/* -- What a spell costs (p296-297) -------------------------------------------- */

const cost = (options) => CNS5.spellCost({ base: 7, ...options }).fatigue;
ok("in an average place", cost({}), 7);
ok("in a low mana one, doubled", cost({ mana: "low" }), 14);
ok("in a high mana one, halved and rounded up", cost({ mana: "high" }), 4);
ok("the Shadow World is a high mana place", cost({ mana: "shadow" }), 4);
ok("and gives a bonus besides", CNS5.manaLevels.shadow.tsc, 10);

ok("from a scroll, half", cost({ source: "scroll" }), 4);
ok("from a device by a mage, a quarter", cost({ source: "deviceMage" }), 2);
ok("from a device by anyone else, half", cost({ source: "deviceOther" }), 4);
ok("a device is spent either way",
   [CNS5.castingSources.deviceMage.charge, CNS5.castingSources.deviceOther.charge],
   [true, true]);

/* The multipliers apply together, which is what makes a scroll in a high mana
   place so cheap and memory in a low one so dear. */
ok("a scroll in a high mana place", cost({ mana: "high", source: "scroll" }), 2);
ok("memory in a low one", cost({ mana: "low", source: "memory" }), 14);
ok("reaching further doubles it again", cost({ extendRange: true }), 14);
ok("and doubling a doubled cost", cost({ mana: "low", extendRange: true }), 28);

/* Rounding is up, as the rules say of a halved cost. */
ok("an odd cost halved rounds up", CNS5.spellCost({ base: 5, mana: "high" }).fatigue, 3);
ok("and quartered too", CNS5.spellCost({ base: 5, source: "deviceMage" }).fatigue, 2);

/* -- Reading the ranges and durations the tables print ----------------------- */

const { parseMagnitude, evaluateMagnitude, spellRangeBands, describeMagnitude } =
  await import(path.join(ROOT, "module", "helpers", "magnitude.mjs"));

const spells = JSON.parse(await readFile(path.join(ROOT, "data", "spells.json"), "utf8")).spells;

/* The figure the tables print is the maximum; short is a tenth of it and long a
   half (p296). A sheet asking for all three was asking for something derived. */
ok("the shares", [CNS5.spellRangeShare.short, CNS5.spellRangeShare.long], [0.1, 0.5]);

const bands = spellRangeBands(parseMagnitude("10’ x ML", "distance"), 6);
ok("a sixth-level mage's reach", bands.max, 60);
ok("his short range", bands.short, 6);
ok("and his long", bands.long, 30);

/* It scales with the caster, which is the whole reason it cannot be stored. */
ok("a first-level mage reaches less",
   spellRangeBands(parseMagnitude("10’ x ML", "distance"), 1).max, 10);
ok("a twentieth-level one far more",
   spellRangeBands(parseMagnitude("10’ x ML", "distance"), 20).max, 200);

/* Units are read as printed and reduced to feet or seconds. */
const feet = (text, ml = 1) => evaluateMagnitude(parseMagnitude(text, "distance"), ml);
ok("a mile", feet("1 mile x ML"), 5280);
ok("a quarter of one", feet("1/4 mile x ML"), 1320);
ok("a fixed part and a scaling one", feet("5’ + 1’ per ML", 6), 11);
ok("a bare quantity", feet("5’"), 5);

const seconds = (text, ml = 1) => evaluateMagnitude(parseMagnitude(text, "time"), ml);
ok("a quarter minute a level", seconds("15 seconds x ML", 4), 60);
ok("a day a level", seconds("1 day x ML", 2), 172_800);
ok("one that shortens with skill", seconds("60 min / ML", 4), 900);
ok("and one that counts down", seconds("60 seconds - (5 x ML)", 4), 40);

/* Words are not failures to read. A spell cast by touch has no range in feet
   and never will, so it is carried through as what it is. */
ok("touch is a word", parseMagnitude("Touch", "distance").kind, "word");
ok("as is self", parseMagnitude("Self", "distance").kind, "word");
ok("and instant", parseMagnitude("Instant", "time").kind, "word");
ok("a word has no figure", evaluateMagnitude(parseMagnitude("Touch", "distance"), 10), null);
ok("and neither has a dash", parseMagnitude("-", "distance").kind, "none");

/* A term the Gamemaster must supply is named rather than guessed at. */
const density = parseMagnitude("10’ x ML x Density", "distance");
ok("an unknown term is named", density.unknown, "Density");
ok("and nothing is invented for it", evaluateMagnitude(density, 6), null);

/* A trailing r marks a radius: the shape of the effect, not its size. */
const area = parseMagnitude("20’ r", "distance");
ok("a radius is noted", area.radius, true);
ok("and still has a size", evaluateMagnitude(area, 1), 20);

/* Across the whole compendium, every range resolves to something — a figure, a
   word, a named unknown, or nothing at all. None is left unreadable. */
const unreadableRanges = spells
  .map((s) => parseMagnitude(s.range, "distance"))
  .filter((p) => p.kind === "asPrinted");
ok("every printed range is read", unreadableRanges.map((p) => p.raw), []);

/* Durations are less tractable: a couple of dozen say things like
   "Concentration" or "Until Destroyed", which are instructions rather than
   quantities and are shown as printed. */
const asPrinted = spells
  .map((s) => parseMagnitude(s.duration, "time"))
  .filter((p) => p.kind === "asPrinted");
ok("most durations are read", asPrinted.length < spells.length / 10, true);

/* Putting figures back into words. */
ok("a short distance", describeMagnitude(60, "distance"), "60 ft");
ok("a long one", describeMagnitude(10_560, "distance"), "2 miles");
ok("a moment", describeMagnitude(45, "time"), "45 seconds");
ok("a while", describeMagnitude(900, "time"), "15 minutes");
ok("a day", describeMagnitude(86_400, "time"), "1 day");

/* -- Learning a spell (pp.293-295) ------------------------------------------- */

/* Table - Time Taken to Learn Spells, every cell of it. The book gives a
   formula too — "21 x (MR / (ML +2)) (round down)" — and the two disagree in
   thirty of the seventy-two cells, always by one. Rounding to nearest matches
   all of them, so the table is followed and the word treated as the error. */
const printedLearning = {
  1: [7, 5, 4, 4, 3, 3, 2, 2, 2, 2],
  2: [14, 11, 8, 7, 6, 5, 5, 4, 4, 4],
  3: [21, 16, 13, 11, 9, 8, 7, 6, 6, 5],
  4: [null, 21, 17, 14, 12, 11, 9, 8, 8, 7],
  5: [null, null, 21, 18, 15, 13, 12, 11, 10, 9],
  6: [null, null, null, 21, 18, 16, 14, 13, 11, 11],
  7: [null, null, null, null, 21, 18, 16, 15, 13, 12],
  8: [null, null, null, null, null, 21, 19, 17, 15, 14],
  9: [null, null, null, null, null, null, 21, 19, 17, 16],
  10: [null, null, null, null, null, null, null, 21, 19, 18]
};

const wrongCells = [];
for (const [mr, row] of Object.entries(printedLearning)) {
  row.forEach((want, index) => {
    if (want === null) return;
    const got = CNS5.daysPerMrStep(Number(mr), index + 1);
    if (got !== want) wrongCells.push(`MR${mr} ML${index + 1}: ${got} not ${want}`);
  });
}
ok("every cell of the table", wrongCells, []);

/* The blanks are where the spell is beyond the mage: "the maximum MR of a
   spell that can be learnt by a Mage is his ML + 2". */
const shouldBeBlank = [];
for (const [mr, row] of Object.entries(printedLearning)) {
  row.forEach((cell, index) => {
    const ml = index + 1;
    const beyond = Number(mr) > CNS5.maxLearnableMr(ml);
    if (beyond !== (cell === null)) shouldBeBlank.push(`MR${mr} ML${ml}`);
  });
}
ok("and every blank is a spell beyond reach", shouldBeBlank, []);

/* The times are cumulative: "a Mage who is ML 5 wishing to learn a MR 3 spell
   requires (9 + 6 + 3) = 18 days". */
const learn = CNS5.daysToLearn(3, 5);
ok("the book's worked example", learn.days, 18);
ok("step by step", learn.steps, [3, 6, 9]);
ok("and it is within his reach", learn.learnable, true);

ok("a mage of Magick Level 5 may reach", CNS5.maxLearnableMr(5), 7);
ok("but no further", CNS5.daysToLearn(8, 5).learnable, false);
ok("though the figure is still given", CNS5.daysToLearn(8, 5).days > 0, true);

/* Research and invention. */
ok("days researching from a book", CNS5.daysOfResearch(3, 5), 24);
ok("a better mage researches quicker", CNS5.daysOfResearch(3, 10), 9);
ok("inventing takes at least three days", CNS5.spellCreation.minimumDays, 3);
ok("a failure costs seven a point", CNS5.spellCreation.retryDaysPerMr, 7);
ok("and a second bars it until he improves", CNS5.spellCreation.improvementNeeded, 5);
ok("on the spot, a tenth of the two together", CNS5.onTheSpotChance(70, 12), 8);

/* -- What a tradition makes of a school -------------------------------------- */

const magick = JSON.parse(await readFile(path.join(ROOT, "data", "magick.json"), "utf8"));

ok("methods in the grid", Object.keys(magick.learningModifiers).length, 13);
ok("modes across it", magick.learningModes.length, 14);
ok(
  "every cell is a figure",
  Object.values(magick.learningModifiers)
    .flatMap((row) => Object.values(row))
    .filter((v) => !Number.isInteger(v)),
  []
);
ok(
  "and none is beyond three either way",
  Object.values(magick.learningModifiers)
    .flatMap((row) => Object.values(row))
    .filter((v) => Math.abs(v) > 3),
  []
);

const effective = (mr, method, mode) =>
  CNS5.effectiveLearningMr({ mr, method, mode, table: magick });

/* A positive figure raises the spell's Magick Resistance, and the days go as
   that — so commands come hard to a Conjurer and readily to a Necromancer. */
ok("a Conjurer at a Command spell", effective(4, "Command Magick", "Conjuration Mode of Magick").modifier, 3);
ok("a Necromancer at the same", effective(4, "Command Magick", "Necromantic Mode of Magick").modifier, -3);
ok("which raises it to", effective(4, "Command Magick", "Conjuration Mode of Magick").effective, 7);
ok("and lowers it to", effective(4, "Command Magick", "Necromantic Mode of Magick").effective, 1);

/* Never below one: no spell is free to learn, however well it suits. */
ok("a perfect fit is still work", effective(1, "Wards Magick", "Air Mode of Magick").effective, 1);
ok("even at three below", effective(2, "Wards Magick", "Air Mode of Magick").effective, 1);

/* The names differ between the table and the skill list, and a miss here would
   silently give every mage a modifier of nothing. */
const methodSkills = [
  "Arcane Magick", "Basic Magick – Air", "Basic Magick – Earth", "Basic Magick – Fire",
  "Basic Magick – Water", "Command Magick", "Divination Magick", "Illusion Magick",
  "Plant Magick", "Summoning Magick", "Transcendental Magick", "Transmutation Magick",
  "Wards Magick"
];
ok(
  "every Method finds its row",
  methodSkills.filter((m) => !CNS5.learningRowFor(m, magick.learningModifiers)),
  []
);

const modeSkills = [
  "Conjuration Mode of Magick", "Divination Mode of Magick", "Enchantment Mode of Magick",
  "Hex Master Mode of Magick", "Necromantic Mode of Magick", "Power Word Mode of Magick",
  "Thaumaturgy Mode of Magick", "Druidic Priest Mode", "Shamanic Priest Mode",
  "Witchcraft Priest Mode"
];
ok(
  "every Mode finds its column",
  modeSkills.filter((m) => !CNS5.learningColumnFor(m, magick.learningModes)),
  []
);

/* Thaumaturgy is spelled "Thaumatrugy" in the table. The data keeps the page's
   spelling; the matching copes with it. */
ok("the book's transposition", magick.learningModes.includes("Thaumatrugy"), true);
ok("matched anyway",
   CNS5.learningColumnFor("Thaumaturgy Mode of Magick", magick.learningModes), "Thaumatrugy");

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
