/**
 * Validate the extracted skills data.
 *
 * These are structural checks on data/skills.json, not on the extractor itself.
 * The extractor's correctness was established by agreement between two
 * independent parses of pp.147-148 — a positional one using word coordinates
 * and a regex pass over the flat text layer — which produced identical page and
 * Difficulty Factor pairs for all 248 entries.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));

const raw = JSON.parse(await readFile(path.join(ROOT, "data", "skills.json"), "utf8"));
const skills = raw.skills;

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const VALID_ATTRIBUTES = new Set(Object.values(CNS5.attributeGroups).flat());

ok("count matches header", skills.length, raw.count);
ok("count", skills.length, 248);

ok("every skill has a name", skills.filter((s) => !s.name?.trim()).length, 0);
ok("no duplicate names", skills.length - new Set(skills.map((s) => s.name)).size, 0);

ok(
  "every Difficulty Factor is in the table",
  skills.filter((s) => !CNS5.difficultyFactors[s.df]).map((s) => s.name),
  []
);

ok(
  "every attribute key is real",
  skills.filter((s) => s.attributes.some((a) => !VALID_ATTRIBUTES.has(a))).map((s) => s.name),
  []
);

ok(
  "skills have zero or two attributes",
  skills.filter((s) => ![0, 2].includes(s.attributes.length)).map((s) => s.name),
  []
);

ok(
  "an empty attribute list is explained",
  skills
    .filter((s) => !s.attributes.length && s.kind !== "competency" && !s.attributeNote)
    .map((s) => s.name),
  []
);

ok("every skill has a rulebook group", skills.filter((s) => !s.category).length, 0);

// The skill descriptions chapter runs pp.149-231. One entry cites p232, which
// is the first page of The Marketplace: the list gives Debate as p232 where its
// description ends on p231. The data is faithful to the printed list, so the
// bound accommodates it rather than silently correcting it.
ok(
  "page references fall inside the skill descriptions chapter",
  skills.filter((s) => Number(s.reference) < 149 || Number(s.reference) > 232).map((s) => s.name),
  []
);

ok(
  "only Debate cites a page past the chapter",
  skills.filter((s) => Number(s.reference) > 231).map((s) => s.name),
  ["Debate"]
);

ok("no description text is shipped", "description" in skills[0], false);

/* -- Skills that cannot be attempted untrained (p33) ------------------------ */

/* "Some skills cannot be attempted unless the character has basic knowledge of
   the skill" — and which they are is marked [TR] in each skill's description
   rather than anywhere in the list, which is why it was never read. */
const trained = skills.filter((s) => s.trainingRequired);
ok("skills needing training", trained.length, 60);
ok("which is a minority of them", trained.length < skills.length / 2, true);

/* Twelve descriptions cannot be found by name, because the list and the
   description word them differently — five kinds of Animal Riding share one
   heading. Those were read from the book by hand rather than assumed, and none
   is left unchecked. */
const verified = skills.filter((s) => s.trainingVerified);
ok("answered by hand", verified.length, 12);
ok("nothing left unchecked", skills.filter((s) => s.trainingUnchecked).length, 0);
ok(
  "the six of them that need training",
  verified.filter((s) => s.trainingRequired).map((s) => s.name).sort(),
  [
    "Garrotting", "Glassblowing & Glazing", "Own Language\u2014Read/Write",
    "Own Language\u2014Spoken", "Sailmaking & Rigging", "Winemaking"
  ]
);

/* A handful checked by hand against the book. */
const needsTraining = (name) => skills.find((s) => s.name === name)?.trainingRequired;
ok("swimming must be taught", needsTraining("Swimming"), true);
ok("so must hurling axes", needsTraining("Hurling Axes"), true);
ok("and jumping", needsTraining("Jumping"), true);
ok("and animal training", needsTraining("Animal Training"), true);

/* Anything not marked can be attempted, which is the whole point of the
   Unskilled column of Table - Difficulty Factors. */
const attemptable = skills.filter((s) => !s.trainingRequired);
ok("most skills can be attempted untrained", attemptable.length, 188);
ok(
  "and every one has a Difficulty Factor to attempt it at",
  attemptable.filter((s) => !CNS5.difficultyFactors[s.df]).map((s) => s.name),
  []
);

/* Every Difficulty Factor has an unskilled chance, even where it is nothing. */
ok(
  "every Difficulty Factor has an unskilled chance",
  Object.values(CNS5.difficultyFactors).filter((b) => b.unskilled === undefined).length,
  0
);
ok("a very simple task untrained", CNS5.difficultyFactors[1].unskilled, 50);
ok("against sixty once taught", CNS5.difficultyFactors[1].skilled, 60);
ok("an impossible one untrained", CNS5.difficultyFactors[10].unskilled, 0);

console.log(`\n${skills.length} skills across ${new Set(skills.map((s) => s.category)).size} groups`);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
