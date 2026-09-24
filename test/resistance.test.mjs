/**
 * Resisting a spell (pp.300-301).
 *
 * "To make a Resisted Roll, the target must make a Willpower TSC% - Caster's
 * Method of Magick PSF%. An unmodified 1D100 roll of between 01-05% is always a
 * success, and an unmodified die roll of 96%+ is always a failure."
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const spells = JSON.parse(await readFile(path.join(ROOT, "data", "spells.json"), "utf8")).spells;

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* -- The chance ------------------------------------------------------------- */

const chance = (options) => CNS5.resistanceChance(options).chance;

ok("Willpower alone", chance({ willpowerTsc: 62 }), 62);
ok("less the caster's skill in the school", chance({ willpowerTsc: 62, casterPsf: 30 }), 32);

/* "-5% for every 2 points the Attribute is over 14 (rounded up). i.e. if the
   Attribute is 19, then the save percentage will be reduced by 15%." */
const presence = CNS5.saveReductions.presence.from;
ok("the book's own example", presence(19), -15);
ok("fourteen is nothing", presence(14), 0);
ok("fifteen rounds up to one step", presence(15), -5);
ok("sixteen is still one step", presence(16), -5);
ok("seventeen is two", presence(17), -10);
ok("and a great presence tells", presence(22), -20);

ok("a mantra", CNS5.saveReductions.mantra.modifier, -5);
ok("dancing or chanting", CNS5.saveReductions.dancing.modifier, -5);
ok("smokes and essences", CNS5.saveReductions.smokes.modifier, -10);

/* "Reduced by -1% per day spent meditating on the spell, to a maximum of -25%." */
ok("a day of meditation", chance({ willpowerTsc: 50, meditationDays: 1 }), 49);
ok("ten days", chance({ willpowerTsc: 50, meditationDays: 10 }), 40);
ok("and it stops at twenty-five", chance({ willpowerTsc: 50, meditationDays: 40 }), 25);
ok("however long is spent", chance({ willpowerTsc: 50, meditationDays: 400 }), 25);

/* Everything applies at once. */
ok(
  "a determined caster against a strong will",
  chance({ willpowerTsc: 62, casterPsf: 30, presence: 19, mantra: true, meditationDays: 10 }),
  2
);

/* -- The bounds on the die --------------------------------------------------- */

/* Both are checked against the *unmodified* die, which is what keeps a save
   from ever being hopeless — or certain. */
ok("the floor", CNS5.resistanceAlwaysSucceeds, 5);
ok("the ceiling", CNS5.resistanceAlwaysFails, 96);

const read = (roll, against) => CNS5.readResistance(roll, against);
ok("a one resists a hopeless save", read(1, 2).resisted, true);
ok("and says why", read(1, 2).certain, "always");
ok("a five still does", read(5, 2).resisted, true);
ok("a six does not", read(6, 2).resisted, false);

ok("ninety-six fails a certain save", read(96, 99).resisted, false);
ok("and says why", read(96, 99).certain, "never");
ok("ninety-five succeeds", read(95, 99).resisted, true);

ok("an ordinary roll under the chance", read(40, 62).resisted, true);
ok("and over it", read(70, 62).resisted, false);
ok("neither being certain", [read(40, 62).certain, read(70, 62).certain], [null, null]);

/* A save of nought or less is still not hopeless, which is the point. */
ok("a save of nothing can still be made", read(3, 0).resisted, true);
ok("a save of a hundred can still be missed", read(98, 100).resisted, false);

/* -- Which spells offer one -------------------------------------------------- */

const offers = (name, group) => CNS5.isResistable({ name, group });

ok("a command spell", offers("Command Person", "Command Magick"), true);
ok("an illusion", offers("Phantasmal Monster", "Illusions Spells"), true);
ok("a fireball does not", offers("Fire Ball", "Basic Magick Fire"), false);

/* Commanding an element is not commanding a mind. */
ok("commanding the air", offers("Create / Command Air", "Basic Magick Air"), false);
ok("nor the earth", offers("Create / Command Earth", "Basic Magick Earth"), false);

/* A Gamemaster's word settles it either way. */
ok("set on", CNS5.isResistable({ name: "Fire Ball", group: "Basic Magick Fire", resisted: true }), true);
ok("set off", CNS5.isResistable({ name: "Command Person", group: "Command Magick", resisted: false }), false);

/* Across the compendium, a minority of spells offer a save, and they are the
   ones that work on the mind. */
const resistable = spells.filter((s) => CNS5.isResistable({ name: s.name, group: s.section }));
ok("spells offering a save", resistable.length, 84);
ok("which is a minority", resistable.length < spells.length / 2, true);
ok(
  "every Command Magick spell does",
  spells.filter((s) => s.section === "Command Magick" && !CNS5.isResistable({ name: s.name, group: s.section })).length,
  0
);
ok(
  "and every Illusion",
  spells.filter((s) => s.section === "Illusions Spells" && !CNS5.isResistable({ name: s.name, group: s.section })).length,
  0
);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
