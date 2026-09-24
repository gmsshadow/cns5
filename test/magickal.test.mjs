/**
 * Magickal items (pp.302-305).
 *
 * A Focus is an aid a spell is cast *through*; a Device holds spells and the
 * charges to cast them. Both carry their maker's Magick Level with them.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const { resolveTargeting } = await import(path.join(ROOT, "module", "helpers", "targeting.mjs"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const focus = CNS5.focusGrades;

/* -- What a Focus gives (pp.304-305) ------------------------------------------ */

ok("skill in the school", ["simple", "lesser", "greater"].map((g) => focus[g].psf), [7, 13, 26]);
ok("aim", ["simple", "lesser", "greater"].map((g) => focus[g].targeting), [5, 10, 15]);
ok("what each may store, per level", ["simple", "lesser", "greater"].map((g) => focus[g].storedMrPerMl), [3, 7, 13]);
ok("and the charges it holds", ["simple", "lesser", "greater"].map((g) => focus[g].chargesPerMl), [3, 7, 13]);
ok("weeks to make", ["simple", "lesser", "greater"].map((g) => focus[g].constructionWeeks), [3, 7, 13]);
ok("the least Magick Level to make one", ["simple", "lesser", "greater"].map((g) => focus[g].minimumMl), [0, 3, 6]);

/* Losing one costs more the better it was. */
ok("the cost of losing one", ["simple", "lesser", "greater"].map((g) => focus[g].lossPenalty), [-14, -26, -42]);
/* Destroyed within 1,000 feet of its maker, each asks a CON AR, and the
   better ones harder: an earlier version had the Lesser Focus asking nothing,
   where p305 gives "a CON AR at a penalty of -13%". */
ok("the Constitution roll when one is destroyed",
   ["simple", "lesser", "greater"].map((g) => focus[g].destroyedConPenalty), [0, -13, -26]);
ok("how long the maker is stunned",
   ["simple", "lesser", "greater"].map((g) => focus[g].stunned),
   ["1d10 rounds", "1d10 minutes", "2d10 minutes"]);
ok("and how long he casts badly without it",
   ["simple", "lesser", "greater"].map((g) => focus[g].lossMonths), [3, 7, 13]);

/* A Greater one recharges daily, the others weekly. */
ok("recharging", ["simple", "lesser", "greater"].map((g) => focus[g].recharge.every), ["week", "week", "day"]);

/* -- What a Focus does to the cost -------------------------------------------- */

/* "Reduced by -2 FP", "halved", "quartered" — and "the minimum cost is always
   1 FP". */
ok("a Simple Focus takes two off", CNS5.focusFatigue(7, "simple"), 5);
ok("a Lesser halves it, rounding up", CNS5.focusFatigue(7, "lesser"), 4);
ok("a Greater quarters it", CNS5.focusFatigue(7, "greater"), 2);
ok("never below one", CNS5.focusFatigue(2, "simple"), 1);
ok("even from one", CNS5.focusFatigue(1, "greater"), 1);
ok("and no Focus changes nothing", CNS5.focusFatigue(7, null), 7);

/* It comes last, lightening whatever else has made the cost. */
const through = (options) => CNS5.spellCost({ base: 8, ...options }).fatigue;
ok("in a low mana place, doubled then halved", through({ mana: "low", focus: "lesser" }), 8);
ok("from a scroll, halved then quartered", through({ source: "scroll", focus: "greater" }), 1);
ok("and the cost before it is kept", CNS5.spellCost({ base: 8, focus: "simple" }).beforeFocus, 8);

/* It is no longer a casting source: a spell is cast through a Focus from
   memory, not read from it. */
ok("a Focus is not a source", "focus" in CNS5.castingSources, false);

/* -- What a Focus does to the chance ------------------------------------------ */

/* Both bonuses bear on the targeting roll. */
ok("a Greater Focus in the open",
   resolveTargeting({ methodTsc: 50, focusBonus: focus.greater.psf + focus.greater.targeting }).total,
   91);
ok("without one", resolveTargeting({ methodTsc: 50 }).total, 50);

/* -- Devices (pp.303-304) ---------------------------------------------------- */

const device = CNS5.deviceGrades;
ok("charges per level", ["simple", "lesser", "greater"].map((g) => device[g].chargesPerMl), [4, 13, 21]);

/* Charges follow the maker, not the bearer. */
ok("a Simple Device by a sixth-level mage", CNS5.itemCharges("device", "simple", 6), 24);
ok("a Greater one", CNS5.itemCharges("device", "greater", 6), 126);
ok("and a Greater Focus", CNS5.itemCharges("focus", "greater", 6), 78);

/* A Simple Device: "a single spell up to MR 7". */
const accepts = (grade, mrs, ml = 5) => CNS5.deviceAccepts(grade, mrs, ml).allowed;
ok("one spell of seven", accepts("simple", [7]), true);
ok("but not of eight", accepts("simple", [8]), false);
ok("nor two spells", accepts("simple", [2, 2]), false);

/* A Lesser Device: "up to 13 spells with a total of MR 21 with no spell having
   a MR of 7 or higher" — so six at most, a lower ceiling than the Simple
   Device's, which is easy to get backwards. */
ok("thirteen spells of one", accepts("lesser", Array(13).fill(1)), true);
ok("but not fourteen", accepts("lesser", Array(14).fill(1)), false);
ok("a spell of six", accepts("lesser", [6]), true);
ok("but not of seven", accepts("lesser", [7]), false);
ok("three of six and one of three", accepts("lesser", [6, 6, 6, 3]), true);
ok("but not one of four", accepts("lesser", [6, 6, 6, 4]), false);

/* A Greater Device: "any amount of spells up to a total MR of 21 x ML... with
   no MR limit". */
ok("any number", accepts("greater", Array(40).fill(1)), true);
ok("of any strength", accepts("greater", [20]), true);
ok("up to twenty-one a level", accepts("greater", [105], 5), true);
ok("and no further", accepts("greater", [106], 5), false);

/* Empowering: "(7 / ML) hours x the Spell MR", in sittings of ten hours. */
ok("an MR 4 spell at ML 5", CNS5.empoweringHours(4, 5).hours, 5.6);
ok("in one sitting", CNS5.empoweringHours(4, 5).sittings, 1);
ok("a long one at ML 1", CNS5.empoweringHours(7, 1).hours, 49);
ok("takes five sittings", CNS5.empoweringHours(7, 1).sittings, 5);

/* -- Casting from a Device (p301) ------------------------------------------ */

/* A Device casts with its maker's skill, not its bearer's. What the bearer
   brings is the Fatigue: "½ normal FP (round up) for Non-mages, or ¼ for Mages
   plus the spending of 1 charge". */
ok("a mage pays a quarter", CNS5.deviceFatigue(8, true), 2);
ok("anyone else half", CNS5.deviceFatigue(8, false), 4);
ok("rounding up", CNS5.deviceFatigue(7, false), 4);
ok("and a quarter of little is still something", CNS5.deviceFatigue(1, true), 1);
ok("a spell costing nothing costs nothing", CNS5.deviceFatigue(0, false), 0);

/* The mana of the place bears on it as on any casting. */
ok("in a low mana place", CNS5.deviceFatigue(8, true, "low"), 4);
ok("in a high one", CNS5.deviceFatigue(8, false, "high"), 2);

/* "If part of the target was used as one of the Material Components then the
   spell gains a bonus of +15% to Targeting TSC%." */
ok("a part of the target in the making", CNS5.materialComponentBonus, 15);

/* A device's chance is its maker's, whatever the bearer's own skill — which is
   the whole reason a man with no magick in him can use one. */
const makersChance = resolveTargeting({ methodTsc: 68 }).total;
ok("the maker's figure is the chance", makersChance, 68);
ok("with a part of the target in it",
   resolveTargeting({ methodTsc: 68, situational: CNS5.materialComponentBonus }).total, 83);

/* Devices are not casting sources. They are cast from, with the maker's
   skill, rather than chosen as a way of reading one's own spell. */
ok("no device appears among the sources",
   Object.keys(CNS5.castingSources).filter((k) => /device/i.test(k)), []);

/* -- Getting a spell out of a Device (p301) ----------------------------------- */

/* "If the caster knows the spell at MR 0 then the casting is automatically
   successful. If the spell is not at MR 0... a penalty of -5% for each MR the
   spell is above 0... On a failure, the casting is unsuccessful but the item
   loses one charge x MR of the spell." */
const activate = (options) => CNS5.deviceActivation({ makerTsc: 68, ...options });

ok("known at MR 0 needs no roll", activate({ mr: 4, known: true }).automatic, true);
ok("and loses nothing from the maker's chance", activate({ mr: 4, known: true }).chance, 68);
ok("unknown, it costs five a point", activate({ mr: 4, known: false }).penalty, -20);
ok("from the maker's chance", activate({ mr: 4, known: false }).chance, 48);
ok("a stronger spell is harder to coax out", activate({ mr: 9, known: false }).chance, 23);
ok("but never below nothing", activate({ mr: 20, known: false }).chance, 0);

/* A success spends the one charge p297 gives; a failure spends the spell's
   whole Magick Resistance — a hard lesson in carrying a wand one does not
   understand. */
ok("a success spends one charge", activate({ mr: 4 }).chargesOnSuccess, 1);
ok("a failure spends four", activate({ mr: 4 }).chargesOnFailure, 4);
ok("a failure at MR 0 still spends one", activate({ mr: 0 }).chargesOnFailure, 1);

/* -- Scrolls (p306) ---------------------------------------------------------- */

/* "Simple scrolls may carry a spell with a MR of 1 to 3, Lesser Scrolls a spell
   of MR 4 to 7 and only Greater scrolls may carry a spell of MR 8+." */
const fits = CNS5.scrollAccepts;
ok("a Simple scroll takes MR 1", fits("simple", 1), true);
ok("and MR 3", fits("simple", 3), true);
ok("but not MR 4", fits("simple", 4), false);
ok("nor MR 0", fits("simple", 0), false);
ok("a Lesser scroll takes MR 4 to 7", [4, 7].map((mr) => fits("lesser", mr)), [true, true]);
ok("but not MR 3 nor 8", [3, 8].map((mr) => fits("lesser", mr)), [false, false]);
ok("a Greater scroll takes MR 8", fits("greater", 8), true);
ok("and anything stronger", fits("greater", 20), true);
ok("but not less", fits("greater", 7), false);

/* The bands meet without gap or overlap, so every spell of MR 1 or more fits
   exactly one grade. */
const grades = Object.keys(CNS5.scrollGrades);
const misfits = [];
for (let mr = 1; mr <= 25; mr++) {
  const count = grades.filter((g) => fits(g, mr)).length;
  if (count !== 1) misfits.push(`MR ${mr} fits ${count}`);
}
ok("every spell fits one grade of scroll", misfits, []);

ok("gems in the dust", grades.map((g) => CNS5.scrollGrades[g].gems), [1, 2, 3]);
ok("an hour a point to inscribe", CNS5.inscribingHours(6), 6);

/* A scroll costs half the Fatigue of casting the spell from memory (p297). */
ok("from a scroll, half the cost", Math.ceil(7 * CNS5.castingSources.scroll.fatigue), 4);

/* -- The rates on p297, checked against a spell costing 6 --------------------- */

/* "Activate a spell in a Magickal device, known or unknown spell: ½ normal FP
   (round up) for Non-mages, or ¼ for Mages plus the spending of 1 charge."
   So Charm, costing 6 from memory, costs a mage 2 from a device and anyone
   else 3 — the quarter of 6 being 1.5, rounded up as the halved figure is. */
ok("Charm from a device, by a mage", CNS5.deviceFatigue(6, true), 2);
ok("by someone with no magick", CNS5.deviceFatigue(6, false), 3);
ok("the mage pays less, never more", CNS5.deviceFatigue(6, true) <= CNS5.deviceFatigue(6, false), true);

/* The mana of the place bears on device casting as on any other. */
ok("doubled in a low mana place", CNS5.deviceFatigue(6, true, "low"), 3);
ok("halved in a high one", CNS5.deviceFatigue(6, false, "high"), 2);

/* "Cast a spell from a scroll or book, known or unknown spell: ½ normal FP
   (round up)" — the same half whoever reads it. */
ok("Charm from a scroll", Math.ceil(6 * CNS5.castingSources.scroll.fatigue), 3);

/* The mana has to be known before the cost is paid, and the cost is paid at
   the casting roll. An earlier version asked the mana only when aiming the
   spell, after the Fatigue had already been taken, so a low mana place never
   doubled what a device or scroll cost. */
const { readFile: read } = await import("node:fs/promises");
const actorSource = await read(path.join(ROOT, "module", "documents", "actor.mjs"), "utf8");
const body = actorSource.slice(actorSource.indexOf("async castFromDevice("));
const asked = body.indexOf("await promptTargeting(");
const paid = body.indexOf("await this.spendMagickCost(");
ok("the casting is declared before it is paid for", asked > 0 && paid > 0 && asked < paid, true);
ok("and the cost is worked out from what was declared", /deviceFatigue\(held\.fp, isMage, declared\.mana\)/.test(body), true);

/* -- A spell not yet fully learnt (p299) ------------------------------------ */

/* "A skill roll is made against his Method of Magick with a penalty of -10% per
   MR over 0." */
ok("ten per cent a point still to learn", CNS5.partlyLearntPenalty, -10);
ok("a spell with three to go", 3 * CNS5.partlyLearntPenalty, -30);

/* Table - Spell Backfire Severity, read from the failed casting's Crit Die. */
const backfire = (die) => CNS5.readBackfire(die);
ok("a one merely fails", backfire(1).key, "fizzle");
ok("for half the Fatigue", backfire(1).fatigue, 0.5);
ok("two to four fail outright", [2, 3, 4].map((d) => backfire(d).key), ["fails", "fails", "fails"]);
ok("for the full Fatigue", backfire(3).fatigue, 1);
ok("five to seven are a major backfire", [5, 7].map((d) => backfire(d).key), ["major", "major"]);
ok("at double Fatigue", backfire(6).fatigue, 2);
ok("eight and nine go off at the mage's feet", [8, 9].map((d) => backfire(d).key), ["extreme", "extreme"]);
ok("and are loose", backfire(8).loose, true);
ok("ten goes off in his hand", backfire(10).key, "disastrous");
ok("with double effect", backfire(10).doubleEffect, true);

/* The die is read as it stood after modifiers. A favourable modifier on a
   failure lowers it, and below one it is read as one; above ten it is still
   the worst the table has. */
ok("below one is read as one", backfire(-2).key, "fizzle");
ok("above ten is still disastrous", backfire(14).key, "disastrous");

/* Every result of the die finds exactly one row. */
const unread = [];
for (let die = 1; die <= 10; die++) {
  const rows = CNS5.backfires.filter((b) => die >= b.min && die <= b.max).length;
  if (rows !== 1) unread.push(`${die}: ${rows}`);
}
ok("every face of the Crit Die has one backfire", unread, []);

/* How long the next step of learning takes, from the table already built. */
ok("three to go at ML 5 is nine days", CNS5.daysToNextStep(3, 5), 9);
ok("a known spell has no next step", CNS5.daysToNextStep(0, 5), null);

/* -- A non-mage aiming (p299) ------------------------------------------------ */

const astray = (roll) => CNS5.readWillpowerFailure(roll).key;
ok("dispelled", [1, 25].map(astray), ["dispelled", "dispelled"]);
ok("the nearest within thirty feet", [26, 40].map(astray), ["near30", "near30"]);
ok("within ten", [41, 55].map(astray), ["near10", "near10"]);
ok("overshooting", [56, 70].map(astray), ["overshoots", "overshoots"]);
ok("falling short", [71, 85].map(astray), ["short", "short"]);
ok("and caught in time", [86, 100].map(astray), ["corrected", "corrected"]);
ok("only the last is a reprieve",
   CNS5.willpowerFailure.filter((w) => w.corrected).map((w) => w.key), ["corrected"]);

const everyRoll = [];
for (let r = 1; r <= 100; r++) {
  if (CNS5.willpowerFailure.filter((w) => r >= w.min && r <= w.max).length !== 1) everyRoll.push(r);
}
ok("every roll of the d100 finds one row", everyRoll, []);

/* -- Spell books (pp.301, 306-307) ------------------------------------------- */

/* "Each spell will require one page per MR of the spell." A spell of no Magick
   Resistance still takes a page to write. */
ok("pages for spells of 3, 5 and 1", CNS5.bookPages([{ mr: 3 }, { mr: 5 }, { mr: 1 }]), 9);
ok("a spell of MR 0 still takes a page", CNS5.bookPages([{ mr: 0 }]), 1);
ok("an empty book has none", CNS5.bookPages([]), 0);

/* Read from a book, a spell costs half, as from a scroll (p297). */
ok("half from a book", CNS5.castingSources.book.fatigue, 0.5);

/* -- The order things happen in --------------------------------------------- */

const source = await read(path.join(ROOT, "module", "documents", "actor.mjs"), "utf8");
const deviceCasting = source.slice(source.indexOf("async castFromDevice("));
const spellCasting = source.slice(source.indexOf("async rollSpell("), source.indexOf("async castFromDevice("));

/* A mage's own book is his own casting, so it is handed to rollSpell with the
   penalty lifted, rather than read at a writer's skill. */
ok("an own book casts the spell as the mage's own",
   /ownBook[\s\S]{0,600}this\.rollSpell\(spell\.id, "short", \{ skipDialog, fromBook: true \}\)/.test(deviceCasting),
   true);

/* Someone else's book loses a page only when its spell fails. */
ok("a page is spent only on a failure",
   /kind === "book"\) \{\s*if \(!released\)/.test(deviceCasting), true);

/* The Willpower roll comes after the spell is out and before it is aimed, and
   neither a mage nor a touch spell makes one. */
const willpowerAt = deviceCasting.indexOf("let willpowerStep = null;");
const aimAt = deviceCasting.indexOf("const targeting = resolveTargeting(");
const releasedAt = deviceCasting.indexOf("if (!released) {");
ok("Willpower is checked after the spell comes out", releasedAt < willpowerAt, true);
ok("and before it is aimed", willpowerAt < aimAt, true);
ok("and only by a non-mage, and not by touch",
   /if \(!isMage && !byTouch\)/.test(deviceCasting), true);

/* A part-learnt spell from memory is cast before it is aimed; one read from the
   mage's own book is not. */
ok("a part-learnt spell is got into shape first",
   /if \(spell\.system\.partlyLearnt && !fromBook\)/.test(spellCasting), true);
ok("and its backfire costs Fatigue at the table's multiple",
   /Math\.ceil\(cost\.fatigue \* backfire\.fatigue\)/.test(spellCasting), true);

/* -- What stands between a caster and his target (p298) ---------------------- */

/* Each protection is targeted in its own right before the victim is, outermost
   first: a Ward stands about a place, an Amulet about a person, a Focus is in
   his hand. */
ok("the order they are met in", CNS5.defenceOrder, ["ward", "amulet", "focus"]);

/* "An amulet will have a MR equal to 5% per level of the spell placed in it. In
   addition, an amulet will automatically increase its MR by 2% for every 25
   years of its existence." */
ok("five per cent a level", CNS5.protectiveMr(4, 0), 20);
ok("and two more for twenty-five years", CNS5.protectiveMr(4, 25), 22);
ok("nothing for twenty-four", CNS5.protectiveMr(4, 24), 20);
ok("four more for sixty", CNS5.protectiveMr(4, 60), 24);
ok("an empty amulet resists nothing", CNS5.protectiveMr(0, 0), 0);
ok("though age alone tells", CNS5.protectiveMr(0, 100), 8);

/* A Focus raised in defence may turn on its bearer. */
ok("one chance in five", CNS5.focusDefenceBackfire, 20);
ok("an overcome amulet discharges for", CNS5.amuletDischargeDays, "1d10");

/* -- Targeting and Meditation, optional (p298) ------------------------------- */

/* "+1% x ML per day of meditation... raised to +2% x ML if he fasts and does
   nothing else... up to +25%." */
const meditate = (days, fasting, ml) =>
  CNS5.targetingMeditationBonus({ days, fasting, magickLevel: ml });
ok("a day at Magick Level 4", meditate(1, false, 4), 4);
ok("five days", meditate(5, false, 4), 20);
ok("fasting doubles it", meditate(3, true, 4), 24);
ok("and it stops at twenty-five", meditate(50, true, 10), 25);
ok("no days, no bonus", meditate(0, true, 10), 0);

/* It is not the meditation that lowers a save (p301). Both are a point a day
   to a ceiling of twenty-five, which is why they are easy to confuse — but this
   one is multiplied by the caster's Magick Level and stored up in a single
   spell, where that one is spent on a casting. */
ok("both run to twenty-five",
   [CNS5.targetingMeditation.maximum, Math.abs(CNS5.saveReductions.meditation.maximum)],
   [25, 25]);
ok("and both a point a day",
   [CNS5.targetingMeditation.perDay, Math.abs(CNS5.saveReductions.meditation.perDay)],
   [1, 1]);
ok("but only this one grows with the caster", meditate(1, false, 6) > meditate(1, false, 1), true);
ok("the save's does not", CNS5.saveReductions.meditation.perDay * 3, -3);

/* -- Temporal range (p296) --------------------------------------------------- */

ok("a spell fades over", CNS5.spellDecayDie, "1d10");

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
