/**
 * Reading what an Act of Faith asks for (pp.404, 441-454).
 *
 * A success chance is a formula measured against whoever is concerned, and a
 * cost names whose Fatigue it takes. Both are parsed from the words the book
 * prints rather than reduced to a number when they are extracted.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const { parseFaithChance, parseFaithCost, faithChanceFor, faithStatistic } = await import(
  path.join(ROOT, "module", "helpers", "faith.mjs")
);
const acts = JSON.parse(await readFile(path.join(ROOT, "data", "acts-of-faith.json"), "utf8")).acts;

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* -- The simplest form ------------------------------------------------------- */

const one = (text) => parseFaithChance(text).variants[0];

ok("a plain Faith roll", one("Faith TSC%")[0].statistic, "faithTsc");
ok("at its full value", one("Faith TSC%")[0].fraction, 1);
ok("against the one praying", one("Faith TSC%")[0].of, "performer");

ok("a penalty is read", one("Faith TSC% -30")[0].modifier, -30);
ok("and does not become a fraction", one("Faith TSC% -30")[0].fraction, 1);

/* Fractions come in both the book's forms. */
ok("two thirds, written long", Math.round(one("2/3 Faith TSC%")[0].fraction * 100), 67);
ok("a half, written short", one("½ Faith TSC%")[0].fraction, 0.5);
ok("a third", Math.round(one("⅓ Priest’s Spirit AR")[0].fraction * 100), 33);
ok("three quarters", one("¾ Cleric’s PFF")[0].fraction, 0.75);

/* Which figure, and whose. */
ok("a Spirit roll", one("Supplicant’s Spirit AR")[0].statistic, "spiritAr");
ok("the Personal Faith Factor", one("¼ Priest’s Spirit AR + PFF")[0].added[0].statistic, "pff");
ok("the recipient's, where named", one("Recipient’s Faith TSC%")[0].of, "recipient");
ok("and everyone else is the one praying",
   ["Cleric’s Spirit AR", "Priest’s Spirit AR", "Believer’s Faith TSC% + PFF"]
     .map((t) => one(t)[0].of),
   ["performer", "performer", "performer"]);

/* -- Clauses joined -------------------------------------------------------- */

/* "then" asks for another roll; "plus" adds into the one before it. */
const chain = one("½ Recipient’s Faith TSC, then ¾ Cleric’s PFF");
ok("two rolls", chain.length, 2);
ok("the first against the recipient", chain[0].of, "recipient");
ok("the second against the cleric", [chain[1].of, chain[1].statistic], ["performer", "pff"]);

const added = one("2/3 Faith TSC, plus Cleric’s PFF");
ok("one roll", added.length, 1);
ok("with a second figure added", added[0].added.length, 1);
ok("which is the PFF", added[0].added[0].statistic, "pff");

/* A semicolon separates alternatives. */
ok("two ways of doing it", parseFaithChance("½ Faith TSC%; ⅓ Faith TSC%").variants.length, 2);

/* -- Every chance in the book ------------------------------------------------ */

const unread = acts
  .filter((a) => a.successChanceText)
  .map((a) => [a.name, parseFaithChance(a.successChanceText)])
  .filter(([, parsed]) => parsed.unread)
  .map(([name]) => name);
ok("every success chance is read", unread, []);

/* -- Costs ------------------------------------------------------------------- */

const cost = (text) => parseFaithCost(text);

ok("a flat cost", cost("-3 FP from Supplicant").charges[0].fatigue, 3);
ok("taken from the one praying", cost("-3 FP from Supplicant").charges[0].of, "performer");
ok("or from the one prayed for", cost("-3 FP from recipient").charges[0].of, "recipient");
ok("the Crit Die of the roll", cost("-Crit Die FP from Supplicant").charges[0].critDie, true);
ok("a third of all he has", cost("-⅓ total FP from Cleric").charges[0].fractionOfTotal, 1 / 3);
ok("and a cost that repeats", cost("-1 FP from Supplicant per hour").charges[0].perHour, true);

/* An offering is the Gamemaster's to settle, and is carried as written. */
ok("an offering", cost("-33 FP from Cleric. Recipient offers S5.").offering, "S5");
ok("alongside the Fatigue", cost("-33 FP from Cleric. Recipient offers S5.").charges[0].fatigue, 33);
ok("two costs in one line", cost("-9 FP from Cleric; -5 FP from Cleric").charges.length, 2);

/* Where the book says the cost is variable, it says so rather than inventing
   a figure. */
ok("variable", cost("Variable from Supplicant").unread, "Variable from Supplicant");
ok("and see below", cost("See Below").unread, "See Below");

const costUnread = acts
  .filter((a) => a.costText)
  .map((a) => [a.name, parseFaithCost(a.costText)])
  .filter(([, parsed]) => parsed.unread)
  .map(([name]) => name);
ok("only two costs are left to the page", costUnread.length, 2);

/* -- Working a chance out for real people ------------------------------------ */

const priest = {
  system: {
    faith: { pff: 24, skillItem: { system: { tsc: 66 } } },
    attr: { spr: { value: 15 } }
  }
};
const sinner = {
  system: { faith: { pff: 8, skillItem: { system: { tsc: 30 } } }, attr: { spr: { value: 9 } } }
};

ok("the priest's Faith", faithStatistic(priest, "faithTsc"), 66);
ok("his Personal Faith Factor", faithStatistic(priest, "pff"), 24);
ok("and his Spirit roll", faithStatistic(priest, "spiritAr"), CNS5.attributeRoll(15));
ok("nobody at all is nothing", faithStatistic(null, "faithTsc"), 0);

const people = { performer: priest, recipient: sinner };
ok("two thirds of his Faith",
   faithChanceFor(one("2/3 Faith TSC%")[0], people).chance, 44);
ok("less thirty",
   faithChanceFor(one("Faith TSC% -30")[0], people).chance, 36);
ok("his Faith and his PFF together",
   faithChanceFor(one("Believer’s Faith TSC% + PFF")[0], people).chance, 90);
ok("half the sinner's Faith",
   faithChanceFor(one("½ Recipient’s Faith TSC, then ¾ Cleric’s PFF")[0], people).chance, 15);
ok("then three quarters of the priest's PFF",
   faithChanceFor(one("½ Recipient’s Faith TSC, then ¾ Cleric’s PFF")[1], people).chance, 18);

/* -- What an Act needs before it may be invoked ------------------------------ */

ok("the standings", Object.keys(CNS5.holyStandings), ["lay", "monastic", "ordained"]);
ok("acts for ordained priests alone", acts.filter((a) => a.ordainedOnly).length, 27);
ok("and the wider reservation", acts.filter((a) => a.monasticOnly).length, 7);

/* -- What Spirit makes of a character (p400) --------------------------------- */

/* Table - Perceived Faith. "Faith does not measure belief in a Deity. That is
   represented by Spirit." */
const believer = CNS5.believerFor;
ok("no belief at all", believer(0), "atheist");
ok("a sceptic", [1, 3].map(believer), ["skeptical", "skeptical"]);
ok("a transgressor", [4, 6].map(believer), ["transgressor", "transgressor"]);
ok("lapsed", [7, 10].map(believer), ["lapsed", "lapsed"]);
ok("a true believer", [11, 20].map(believer), ["true", "true"]);
ok("devout", [21, 35].map(believer), ["devout", "devout"]);
ok("fervent", [36, 49].map(believer), ["fervent", "fervent"]);
ok("and saintly", [50, 500].map(believer), ["saintly", "saintly"]);

/* The bands meet without gap or overlap. */
const bands = [];
for (let spr = 0; spr <= 120; spr++) {
  if (CNS5.perceivedFaith.filter((b) => spr >= b.min && spr <= b.max).length !== 1) bands.push(spr);
}
ok("every figure of Spirit falls in one band", bands, []);

/* "He may raise his Current Spirit by +1 for every 5% PSF (rounded up)." */
ok("five per cent is one", CNS5.spiritFromFaith(5), 1);
ok("six is two, rounding up", CNS5.spiritFromFaith(6), 2);
ok("twenty-three is five", CNS5.spiritFromFaith(23), 5);
ok("and nothing is nothing", CNS5.spiritFromFaith(0), 0);

/* -- What an Act does to Spirit (p400) --------------------------------------- */

/* The intercessor expends Current Spirit equal to the Act's Fatigue cost.
   Granted, he has it all back — and one more on a Crit Die of ten. Denied, he
   has half back; on a critical failure, none. */
const after = (success, crit) => CNS5.spiritAfterAct({ cost: 6, success, critTotal: crit });
ok("granted, nothing is lost", after(true, 4).net, 0);
ok("and all of it returns", after(true, 4).regained, 6);
ok("granted on a ten, one is gained", after(true, 10).net, 1);
ok("denied, half comes back", after(false, 4).regained, 3);
ok("so half is lost", after(false, 4).net, -3);
ok("denied on a ten, none comes back", after(false, 10).regained, 0);
ok("and all of it is lost", after(false, 10).net, -6);

/* An odd cost halves downward: he gets back the lesser half. */
ok("five expended, two returned", CNS5.spiritAfterAct({ cost: 5, success: false, critTotal: 3 }).regained, 2);

/* An Act that costs nothing moves nothing. */
ok("nothing spent, nothing moved", CNS5.spiritAfterAct({ cost: 0, success: false, critTotal: 10 }).net, 0);

/* -- Miracles (p401) --------------------------------------------------------- */

/* A believer gains; someone of another faith gains in the new religion and
   loses in his own, which is why those entries are a pair. */
ok("a Greater Miracle for the believer who receives it", CNS5.miracleBonus.greater.believerCrit, 4);
ok("and for the cleric who invoked it", CNS5.miracleBonus.greater.cleric, 1);
ok("a witness gains less", CNS5.miracleBonus.greater.witness, 2);
ok("an unbeliever gains in one faith and loses in his own",
   CNS5.miracleBonus.greater.unbelieverCrit, [5, -6]);
ok("every unbeliever entry is such a pair",
   Object.values(CNS5.miracleBonus)
     .flatMap((m) => [m.unbeliever, m.unbelieverCrit, m.unbelieverWitness, m.unbelieverWitnessCrit])
     .filter((v) => !Array.isArray(v) || v.length !== 2),
   []);

/* -- Who may be prayed for (p403) -------------------------------------------- */

const aid = (options) => CNS5.divineAidFor(options);

/* "Anyone: for himself." Below True Believer, nobody else may be named at all. */
ok("an atheist prays for himself", aid({ believer: "atheist", spirit: 0 }).others, 0);
ok("and may not name another", aid({ believer: "lapsed", spirit: 9 }).instead, false);

/* "True Believer: for himself or for someone instead of himself." Instead, not
   in addition — which is why the two are told apart. */
const trueBeliever = aid({ believer: "true", spirit: 15 });
ok("a true believer prays for none besides himself", trueBeliever.others, 0);
ok("but may name one in his place", trueBeliever.instead, true);

ok("a devout believer prays for one besides", aid({ believer: "devout", spirit: 25 }).others, 1);
ok("a fervent for half his Spirit", aid({ believer: "fervent", spirit: 40 }).others, 20);
ok("rounding down", aid({ believer: "fervent", spirit: 37 }).others, 18);
ok("and a sainted for his Spirit", aid({ believer: "saintly", spirit: 55 }).others, 55);

/* Office counts for far more than belief, which is the point of ordination. */
ok("a monastic reaches five times his Spirit",
   aid({ believer: "lapsed", standing: "monastic", spirit: 20 }).others, 100);
ok("an ordained priest ten times",
   aid({ believer: "lapsed", standing: "ordained", spirit: 20 }).others, 200);
ok("a priestly mage three times, his attention being divided",
   aid({ believer: "lapsed", standing: "ordained", spirit: 20, priestlyMage: true }).others, 60);
ok("and office is what counts where it is the greater",
   aid({ believer: "saintly", standing: "ordained", spirit: 50 }).by, "office");
ok("though belief wins where it is",
   aid({ believer: "saintly", standing: "lay", spirit: 50 }).by, "belief");

/* -- The Belief Pool (p403) -------------------------------------------------- */

const pool = (o) => CNS5.beliefPoolFormula(o);

ok("congregations", Object.keys(CNS5.congregations).length, 8);
ok("a small rural congregation", pool({ congregation: "smallRural" }).multiplier, 1);
ok("a very large town one", pool({ congregation: "veryLargeTown" }).multiplier, 3.5);

/* "These bonuses are added to the basic Belief Pool... cumulative with those
   for building which exist there." */
ok("a cathedral adds four", pool({ congregation: "smallRural", place: "cathedral" }).multiplier, 5);
ok("a national shrine twelve more",
   pool({ congregation: "smallRural", place: "cathedral", shrine: "national" }).multiplier, 17);
ok("a major monastic house", CNS5.holyPlaces.majorMonastic.multiplier, 6);
ok("and nothing at all yields nothing", pool({}).multiplier, 0);

/* Each figure is a multiple of a d10, so a half is half a die. */
ok("three and a half dice", pool({ congregation: "veryLargeTown" }).formula, "3d10 + floor(1d10 / 2)");
ok("a whole number is whole dice", pool({ congregation: "largeRural" }).formula, "2d10");
ok("and no congregation rolls nothing", pool({}).formula, "0");

/* "If a Devout Believer, 3 x usual number" — a believing clergyman reaches
   further than an indifferent one (Table - Acts of Faith, p403). */
ok("a devout clergyman", CNS5.clergyReach("devout", 10), 30);
ok("a fervent one", CNS5.clergyReach("fervent", 10), 70);
ok("a sainted one", CNS5.clergyReach("saintly", 10), 120);
ok("and anyone else reaches the usual number", CNS5.clergyReach("true", 10), 10);

/* -- Spiritual Aura (p404) --------------------------------------------------- */

/* "Calculated by dividing their Current SPR... by 10 (round down). The radius
   of this field being equal to a 1/4 mile (440 yards) per point of aura
   strength. Each point... influences all rolls by +/-5% per aura point." */
const aura = CNS5.spiritualAura;
ok("nine Spirit radiates nothing", aura(9).points, 0);
ok("ten radiates one", aura(10).points, 1);
ok("thirty-four, three", aura(34).points, 3);
ok("a quarter mile a point", aura(3 * 10).radiusYards, 1320);
ok("and five per cent a point", aura(34).modifier, 15);

/* A man of negative Spirit radiates the other way — "evil spirits are
   magnetically drawn by those with low or negative Spirit". The book says
   round down, which taken literally would make -15 a stronger aura than +15;
   the two are treated alike here. */
ok("negative Spirit radiates negatively", aura(-34).points, -3);
ok("as strongly as the same Spirit positively", aura(-15).points, -aura(15).points);
ok("with the same reach", aura(-34).radiusYards, aura(34).radiusYards);
ok("and the modifier turns about", aura(-34).modifier, -15);
ok("nothing radiates nothing", aura(0).points, 0);

/* "Closely bound groups... may combine the individuals' separate SPR auras
   together into a sum total." The Spirits are added and the aura taken of the
   whole: a dozen men of nine radiate nothing apiece and a great deal together,
   which is what a congregation is for. */
ok("one man of nine", aura(9).points, 0);
ok("but a dozen of them", CNS5.combinedAura(Array(12).fill(9)).points, 10);
ok("and their reach", CNS5.combinedAura(Array(12).fill(9)).radiusYards, 4400);

/* -- Witnessing a miracle (p401) --------------------------------------------- */

const saw = (o) => CNS5.miracleSpirit(o);

/* A believer gains outright. */
ok("a bystander of the faith at a greater miracle",
   saw({ level: "greater", role: "witness" }).own, 2);
ok("the one it was worked upon, plainly divine",
   saw({ level: "greater", role: "believer", critical: true }).own, 4);
ok("and the cleric who invoked it", saw({ level: "greater", role: "cleric", critical: true }).own, 3);
ok("a minor miracle is worth less", saw({ level: "minor", role: "believer" }).own, 1);
ok("and gains the cleric nothing at all", saw({ level: "minor", role: "cleric" }).own, 0);

/* One of another religion gains in the faith he has just seen at work and
   loses in his own — which is why the entries are pairs. */
const stranger = saw({ level: "greater", role: "believer", sameFaith: false, critical: true });
ok("he gains toward the new faith", stranger.newFaith, 5);
ok("and loses in his own", stranger.own, -6);
ok("a bystander of another faith less so",
   [saw({ level: "greater", role: "witness", sameFaith: false }).newFaith,
    saw({ level: "greater", role: "witness", sameFaith: false }).own], [2, -2]);
ok("and a minor miracle moves an unbeliever not at all",
   saw({ level: "minor", role: "witness", sameFaith: false }), { own: 0, newFaith: 0 });

/* Those of the faith never lose by it. */
const losses = [];
for (const level of Object.keys(CNS5.miracleLevels)) {
  for (const role of Object.keys(CNS5.miracleRoles)) {
    for (const critical of [false, true]) {
      const change = saw({ level, role, critical });
      if (change.own < 0) losses.push(`${level}/${role}`);
    }
  }
}
ok("a believer never loses by a miracle", losses, []);

/* -- Sharing the cost with the flock (p402) --------------------------------- */

/* "He may draw upon -2 FP from the Belief Pool for every -1 FP he expends from
   his personal FP." An earlier version let the pool pay the whole of it, so a
   priest with a full pool paid nothing. */
const share = CNS5.shareFaithCost;
ok("a 48 FP Act with a full pool", share(48, 100), { own: 16, fromPool: 32 });
ok("the flock pays twice his share", share(48, 100).fromPool, 2 * share(48, 100).own);
ok("never the whole", share(6, 50).own > 0, true);
ok("an odd cost falls on him", share(7, 50), { own: 3, fromPool: 4 });

/* Whatever the pool cannot meet falls back on him. */
ok("a pool of ten covers ten", share(48, 10), { own: 38, fromPool: 10 });
ok("an empty pool covers nothing", share(48, 0), { own: 48, fromPool: 0 });
ok("and the two always make the whole", [
  share(48, 100), share(48, 10), share(33, 22), share(7, 50)
].every((x, i) => x.own + x.fromPool === [48, 48, 33, 7][i]), true);

/* "When away from his congregation... a priest can still draw on 1/3 of the FP
   he normally could." */
ok("a third away from his flock", Math.round(CNS5.awayFromFlockShare * 30), 10);

/* -- Every described Act has its cost ---------------------------------------- */

/* One Cost line puts its sign before the dots — "Cost: - .....24 FP from
   Cleric" — and the pattern that expected the dots straight after the colon
   missed it, leaving Cure Disease without a cost at all. */
ok("every described act has a cost",
   acts.filter((a) => a.described && a.name !== "Greater Miracle" && !a.costText).map((a) => a.name), []);
ok("Cure Disease among them", acts.find((a) => a.name === "Cure Disease").costText.startsWith("-24 FP"), true);

/* Every Priestly Magick costs a figure the one performing it pays, and the
   compendium must show it rather than nought. */
const flat = (text) => parseFaithCost(text).charges
  .filter((c) => c.of === "performer" && Number.isFinite(c.fatigue))
  .reduce((t, c) => t + c.fatigue, 0);
const priestly = acts.filter((a) => a.section.includes("Priestly"));
ok("the priestly magicks", priestly.length, 11);
ok("each with a figure", priestly.filter((a) => flat(a.costText) === 0).map((a) => a.name), []);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
