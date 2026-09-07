/**
 * Validate the extracted spell data.
 *
 * Correctness of the extraction was established the same way as the skills and
 * gear: a positional parse using word coordinates, reconciled page by page
 * against an independent pass over the flat text layer. Every one of the
 * eighteen table pages matched. These are the structural checks on the result.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const raw = JSON.parse(await readFile(path.join(ROOT, "data", "spells.json"), "utf8"));
const spells = raw.spells;

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

ok("count matches header", spells.length, raw.count);
ok("count", spells.length, 313);

ok("every spell has a name", spells.filter((s) => !s.name?.trim()).length, 0);
ok("every spell sits in a section", spells.filter((s) => !s.section).map((s) => s.name), []);

/* Description pages fall inside the magick chapter. */
ok(
  "page references are in range",
  spells.filter((s) => s.reference < 315 || s.reference > 410).map((s) => s.name),
  []
);

/* Every spell that is not a variant states its own Magick Resistance and
   casting time; a variant prints only what differs from its parent. */
ok(
  "full entries state a Magick Resistance",
  spells.filter((s) => !s.parent && !s.incomplete && !s.mr).map((s) => s.name),
  []
);
ok(
  "the variants found",
  spells.filter((s) => s.parent).map((s) => s.name),
  ["Acrid Smoke", "Sulphurous Fumes", "Deadly Vapours", "Sulphur & Brimstone"]
);

/* One row prints a name and a page and nothing else. That is how the book has
   it, so it is flagged rather than filled in or mistaken for a variant. */
ok(
  "entries the table leaves blank",
  spells.filter((s) => s.incomplete).map((s) => s.name),
  ["Shadow Missiles"]
);
ok(
  "every variant names a parent that exists",
  spells
    .filter((s) => s.parent && !spells.some((p) => p.name === s.parent && !p.parent))
    .map((s) => s.name),
  []
);

/* Costs are either a number or one of the rulebook's own words. */
const VARIABLE = /^(var|spec|\d+(\s*(per|\+|\+\d+ per|x ML))?)$/i;
ok(
  "Magick Resistance is a number or a stated variable",
  spells.filter((s) => s.mr && !VARIABLE.test(s.mr)).map((s) => `${s.name}: ${s.mr}`),
  []
);

/* Three spells appear under two sections apiece, with different pages or
   costs. They are separate entries, not a double read. */
const counts = spells.reduce((acc, s) => {
  acc[s.name] = (acc[s.name] ?? 0) + 1;
  return acc;
}, {});
ok(
  "the spells listed twice",
  Object.entries(counts).filter(([, n]) => n > 1).map(([name]) => name).sort(),
  ["Clouds & Rain", "Detect Illusions", "Mist & Fog"]
);
ok(
  "and none appears more than twice",
  Object.values(counts).filter((n) => n > 2).length,
  0
);

/* Every prerequisite should name a spell in the list. Two do not, and both are
   the book's own doing: Dispel Illusions gives a condition where a spell name
   belongs, and Dispel Phantasmals asks for "Dispel Illusion" where the spell is
   called Dispel Illusions. Naming them keeps a real extraction fault from
   hiding among them. */
const names = new Set(spells.map((s) => s.name));
ok(
  "prerequisites that name no spell",
  spells
    .filter((s) => s.prerequisite && !/\bor\b|\band\b/i.test(s.prerequisite))
    .filter((s) => !names.has(s.prerequisite))
    .map((s) => s.name)
    .sort(),
  ["Dispel Illusions", "Dispel Phantasmals"]
);

ok("no description text is shipped", "description" in spells[0], false);

console.log(
  `\n${spells.length} spells across ${new Set(spells.map((s) => s.section)).size} groups`
);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
