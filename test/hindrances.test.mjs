/**
 * Spiritual Hindrances (pp.399, 407-412).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const list = JSON.parse(await readFile(path.join(ROOT, "data", "hindrances.json"), "utf8")).hindrances;

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* -- The list (pp.408-411) --------------------------------------------------- */

ok("hindrances", list.length, 37);
const kind = (k) => list.filter((h) => h.kind === k).length;
ok("physical and worldly", kind("physical"), 12);
ok("self-delusional", kind("self"), 14);
ok("cosmic", kind("cosmic"), 11);

ok("Dark ones — four, five and four across the kinds", list.filter((h) => h.dark === "dark").length, 13);
ok("and the one that is only potentially so",
   list.filter((h) => h.dark === "potential").map((h) => h.name), ["Impulsive Action"]);

ok("names are unique", new Set(list.map((h) => h.name)).size, list.length);
ok("the book's slip is put right", list.some((h) => h.name === "Bacchanalianism"), true);
ok("and not carried", list.some((h) => /nalnai/.test(h.name)), false);

/* The descriptions are the rulebook's. */
ok("no description shipped",
   [...new Set(list.flatMap((h) => Object.keys(h)))].sort(), ["dark", "kind", "name", "page"]);

/* -- The ceiling on Spirit (p399) -------------------------------------------- */

/* "A PC with seven hindrances has a maximum Spirit score of 14, a PC with 1
   hindrance a maximum of 100, and a saint with none has a totally unlimited
   Spirit ability." */
ok("seven hindrances", CNS5.maximumSpirit(7), 14);
ok("one", CNS5.maximumSpirit(1), 100);
ok("none at all", CNS5.maximumSpirit(0), Infinity);
ok("five, the usual start", CNS5.maximumSpirit(5), 20);
ok("three, rounding down", CNS5.maximumSpirit(3), 33);

/* -- Starting hindrances (p407) ---------------------------------------------- */

ok("five to start", CNS5.startingHindrances.count, 5);
ok("two of them major", CNS5.startingHindrances.major, 2);
ok("a Dark one worth five PC Points", CNS5.darkHindrancePcPoints, 5);

/* -- Grace (p408) ------------------------------------------------------------ */

/* "1/4 Crit Die (round up) for a minor hindrance, 1/2 Crit Die (round up) for a
   major hindrance and Crit Die for a severe hindrance." */
ok("a minor one on a seven", CNS5.graceFor("minor", 7), 2);
ok("a major one", CNS5.graceFor("major", 7), 4);
ok("a severe one", CNS5.graceFor("severe", 7), 7);
ok("rounding up", CNS5.graceFor("minor", 1), 1);
ok("and a bad Crit Die is nothing", CNS5.graceFor("severe", 0), 0);

/* The morality check may be made by Faith instead of Willpower. */
ok("by two thirds of Faith", Math.round(CNS5.moralityByFaith * 90), 60);
ok("and a hindrance put to use", CNS5.hindranceUseBonus, 25);

/* -- Recognising one (p411) -------------------------------------------------- */

/* "Minor hindrances are much harder to discover as they are less obvious." */
ok("the Crit Die to recognise", ["minor", "major", "severe"].map((s) => CNS5.discoverCritDie[s]), [4, 6, 8]);

/* -- Being rid of one (pp.411-412) ------------------------------------------- */

/* "Last 3, 2nd 4, 3rd 5, 4th 6, 5th 7, 6th 8, 7th 9, 8th 10." */
ok("the Crit Die to overcome, by how many are held",
   [1, 2, 3, 4, 5, 6, 7, 8].map(CNS5.eliminateCritDie), [3, 4, 5, 6, 7, 8, 9, 10]);
ok("and never above ten", CNS5.eliminateCritDie(12), 10);

/* "Crit Die Unsuccessful Result: 01-05 No-effect. 06-07 Hindrance increases a
   level in severity. 08-09... or develops into a dark hindrance... 10
   Hindrance is replaced by a dark attachment." */
const back = (d) => CNS5.readEliminationBackfire(d).key;
ok("one to five, nothing", [1, 5].map(back), ["noEffect", "noEffect"]);
ok("six and seven, worse", [6, 7].map(back), ["worsens", "worsens"]);
ok("eight and nine, worse or Dark", [8, 9].map(back), ["worsensOrDark", "worsensOrDark"]);
ok("ten, replaced by a Dark one", back(10), "replacedByDark");

const faces = [];
for (let d = 1; d <= 10; d++) {
  if (CNS5.eliminationBackfire.filter((r) => d >= r.min && d <= r.max).length !== 1) faces.push(d);
}
ok("every face of the Crit Die has one result", faces, []);

/* "A Willpower roll must be made with a penalty of -25%" to redeem a Dark one. */
ok("redeeming a Dark hindrance", CNS5.redeemDarkPenalty, -25);

/* Severity rises in order. */
ok("the order of severity", CNS5.severityOrder, ["minor", "major", "severe"]);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
