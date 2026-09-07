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
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));

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

/* -- Spells to Modes of Magick --------------------------------------------- */

/* A spell takes its targeting chance from a Mode of Magick skill, so any Mode
   the mapping names must exist in the skill list. The elemental skills carry en
   dashes where the spell tables use spaces, which is exactly the kind of near
   miss that only shows up when someone tries to cast. */
const skills = JSON.parse(await readFile(path.join(ROOT, "data", "skills.json"), "utf8")).skills;
const skillNames = new Set(skills.map((s) => s.name));

ok(
  "every mapped Mode exists as a skill",
  Object.values(CNS5.spellGroupModes).filter((m) => !skillNames.has(m)),
  []
);

ok(
  "every mapped group is a real spell group",
  Object.keys(CNS5.spellGroupModes).filter((g) => !spells.some((s) => s.section === g)),
  []
);

/* The groups left unmapped fall back to the caster's own Mode. Naming them
   keeps an accidental omission from passing as a deliberate one. */
const unmapped = [...new Set(spells.map((s) => s.section))]
  .filter((g) => !CNS5.spellGroupModes[g])
  .sort();
ok("groups left to the caster's own Mode", unmapped, [
  "Common Elemental Control Spells",
  "Common Method Spells",
  "Eldritch Missiles",
  "Eldritch Servants",
  "Healing Spells",
  "Portals to the Shadow World",
  "Shadow Monsters"
]);

ok(
  "most spells name a Mode of their own",
  spells.filter((s) => CNS5.spellGroupModes[s.section]).length,
  279
);

/* A spell with an explicit Mode keeps it; otherwise the group decides; only
   then does the caster's Mode apply. */
ok("an explicit Mode wins", CNS5.spellMode({ mode: "Hex Master Mode of Magick", group: "Command Magick" }, "Arcane Magick"), "Hex Master Mode of Magick");
ok("otherwise the group decides", CNS5.spellMode({ mode: "", group: "Basic Magick Fire" }, "Arcane Magick"), "Basic Magick – Fire");
ok("and failing that the caster's own", CNS5.spellMode({ mode: "", group: "Healing Spells" }, "Arcane Magick"), "Arcane Magick");
ok("with nothing at all it stays empty", CNS5.spellMode({ mode: "", group: "Healing Spells" }, ""), "");

ok("no description text is shipped", "description" in spells[0], false);

console.log(
  `\n${spells.length} spells across ${new Set(spells.map((s) => s.section)).size} groups`
);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
