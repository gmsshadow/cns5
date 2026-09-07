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

console.log(`\n${skills.length} skills across ${new Set(skills.map((s) => s.category)).size} groups`);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
