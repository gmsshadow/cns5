/**
 * Talents, flaws, deficiencies and phobias (pp.88-97).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const raw = JSON.parse(await readFile(path.join(ROOT, "data", "traits.json"), "utf8"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const { talents, flaws, additionalFlaws, phobias } = raw;

/** Which results of 1 to 100 a table covers, and which it covers twice. */
function coverage(rows, sides = 100) {
  const counts = new Array(sides + 1).fill(0);
  for (const row of rows) {
    for (let n = row.roll[0]; n <= row.roll[1]; n++) counts[n] += 1;
  }
  const missing = [];
  const overlapping = [];
  for (let n = 1; n <= sides; n++) {
    if (counts[n] === 0) missing.push(n);
    if (counts[n] > 1) overlapping.push(n);
  }
  return { missing, overlapping };
}

/* -- Special Abilities & Talents (p88) ------------------------------------- */

ok("talent count", talents.length, 34);
ok("the table covers every roll", coverage(talents).missing, []);
ok("and no roll twice", coverage(talents).overlapping, []);

/* Four abilities are reserved for the Well Aspected, marked (w) in the table. */
ok(
  "the Well Aspected abilities",
  talents.filter((t) => t.wellAspectedOnly).map((t) => t.name),
  ["Fey Affinity", "Fey Blood", "Incredibly Lucky", "Speak with Animals"]
);

/* Thirteen can only be come by on the dice: the table gives them no price. */
ok("abilities that cannot be bought", talents.filter((t) => t.randomOnly).length, 13);
ok(
  "and those are exactly the ones without a cost",
  talents.filter((t) => t.randomOnly !== (t.pcCost === null)).map((t) => t.name),
  []
);
ok(
  "every price is one the table uses",
  [...new Set(talents.filter((t) => t.pcCost !== null).map((t) => t.pcCost))].sort((a, b) => a - b),
  [0, 3, 5, 7, 10]
);

/* Table - Special Abilities Outcomes (p88) decides how many are had at all. */
const outcome = (roll) => CNS5.talentOutcomes.find((o) => roll <= o.max);
ok("a roll of 1 gives three", outcome(1).count, 3);
ok("a roll of 9 gives two", outcome(9).count, 2);
ok("a roll of 50 gives one", outcome(50).count, 1);
ok("a roll of 51 gives none", outcome(99).count, 0);
ok("and a hundred lets you choose", outcome(100).choose, true);

/* -- Flaws, Deficiencies & Defects (p95) ----------------------------------- */

ok("flaw count", flaws.length, 39);

/* The table runs to 99. Roll 100 has no entry printed in its own columns —
   the row carries the roll and nothing else — so it is absent rather than
   guessed at. */
ok("what the flaws table leaves uncovered", coverage(flaws).missing, [100]);
ok("and it covers nothing twice", coverage(flaws).overlapping, []);

/* Flaws grant points; that is the reason to take one on purpose. */
ok(
  "every flaw grants points",
  flaws.filter((f) => !(f.pcBonus > 0)).map((f) => f.name),
  []
);

/* The small 1D10 table at the foot of the page. */
ok("the additional table has five rows", additionalFlaws.length, 5);
ok("and covers a d10 exactly", coverage(additionalFlaws, 10), { missing: [], overlapping: [] });

/* -- Phobias (pp.96-97) ---------------------------------------------------- */

ok("phobia count", phobias.length, 31);
ok("the table covers every roll", coverage(phobias).missing, []);
ok("and no roll twice", coverage(phobias).overlapping, []);
ok("every phobia names its fear", phobias.filter((p) => !p.fear?.trim()).map((p) => p.name), []);
ok(
  "and every fear reads as one",
  phobias.filter((p) => !/^Fear of/i.test(p.fear)).map((p) => p.name),
  []
);

/* The one entry whose name straddles its own roll, printed half above and half
   below, which is the case a simpler parser gets wrong. */
ok(
  "the name printed either side of its roll",
  phobias.find((p) => p.roll[0] === 14)?.name,
  "Androphobia (Female) or Gynophobia (Male)"
);

/* -- Phobia severity (p94) -------------------------------------------------- */

ok("a minor phobia", CNS5.phobiaSeverities.minor.willpower, -10);
ok("a major one", CNS5.phobiaSeverities.major.willpower, -20);
ok("a severe one", CNS5.phobiaSeverities.severe.willpower, -30);
ok("the chance of proving worse", CNS5.phobiaEscalationChance, 13);
ok("Ferocity may stand in from 16", CNS5.fearAlternatives.ferocity.minimum, 16);
ok("and piety takes a flat penalty", CNS5.fearAlternatives.piety.modifier, -15);

/* Having a talent obliges a roll for a flaw, on 01-40 (p94). */
ok("the chance of a flaw", CNS5.flawChance, 40);

/* -- Description pages ------------------------------------------------------ */

/* The sheet cites where an entry is described, not where its table is: once a
   talent has been rolled, the table it came from is of no further use. */
ok(
  "every talent knows its description page",
  talents.filter((t) => !t.descriptionPage).map((t) => t.name),
  []
);
ok(
  "every flaw knows its description page",
  flaws.filter((f) => !f.descriptionPage).map((f) => f.name),
  []
);

/* Talent descriptions run pp.89-94, deficiency descriptions pp.97-101. Nothing
   should cite the page its own table sits on — that was the bug this replaced. */
ok(
  "talent pages fall in the descriptions",
  [...new Set(talents.map((t) => t.descriptionPage))].sort((a, b) => a - b),
  [89, 90, 91, 92, 93]
);
ok(
  "flaw pages fall in the descriptions",
  [...new Set(flaws.map((f) => f.descriptionPage))].sort((a, b) => a - b),
  [97, 98, 99, 100, 101]
);
ok("no flaw cites its own table page", flaws.filter((f) => f.descriptionPage === 95).length, 0);

/* Two names wrap in the printed table, one across a hyphen. */
ok("a name broken across a hyphen", flaws.find((f) => f.roll[0] === 68)?.name, "Manic-Depressive");
ok("a name wrapped onto the next line", flaws.find((f) => f.roll[0] === 67)?.name, "Major Phobia");

ok("no description text is shipped", "description" in talents[0], false);

console.log(`\n${talents.length} talents, ${flaws.length + additionalFlaws.length} flaws, ${phobias.length} phobias`);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
