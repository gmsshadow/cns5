/**
 * Validate the language file.
 *
 * Foundry expands dotted keys into a nested object before use, so a key that is
 * also the prefix of another key collides: one wants to be a string, the other
 * needs it to be an object. When that happens the whole file fails to load and
 * every label on every sheet falls back to its raw key. It is a single-character
 * mistake with a total blast radius, which is exactly what a test is for.
 */

import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lang = JSON.parse(await readFile(path.join(ROOT, "lang", "en.json"), "utf8"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const keys = Object.keys(lang);

ok(
  "no key is a prefix of another",
  keys.filter((k) => keys.some((o) => o !== k && o.startsWith(`${k}.`))),
  []
);

ok("every value is a string", keys.filter((k) => typeof lang[k] !== "string"), []);
ok("no key is blank", keys.filter((k) => !k.trim()), []);
ok("no value is blank", keys.filter((k) => !lang[k].trim()), []);

/* Interpolation placeholders must be well formed, or the label renders with
   braces showing. */
ok(
  "placeholders are closed",
  keys.filter((k) => (lang[k].match(/{/g) ?? []).length !== (lang[k].match(/}/g) ?? []).length),
  []
);

/* -- Every key the code asks for must exist ------------------------------- */

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = (await walk(ROOT)).filter((f) => f.endsWith(".hbs") || f.endsWith(".mjs"));
const missing = new Set();
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const m of text.matchAll(/localize\s+"([^"]+)"/g)) {
    if (!(m[1] in lang)) missing.add(m[1]);
  }
  for (const m of text.matchAll(/i18n\.(?:localize|format)\(\s*"([^"]+)"/g)) {
    if (!(m[1] in lang)) missing.add(m[1]);
  }
}
ok("every key referenced in code exists", [...missing].sort(), []);

console.log(`\n${keys.length} localisation keys`);
/* Every name in the CNS5 namespace is defined once. A second definition
   replaces the first without a word, so a table added in one place can quietly
   overwrite one with the same name a thousand lines above it — which is how
   the talent outcomes came to be defined twice, in two different shapes, with
   the later one breaking what relied on the earlier. */
const configSource = await readFile(path.join(ROOT, "module", "config.mjs"), "utf8");
const definitions = [...configSource.matchAll(/^CNS5\.([A-Za-z]+) =/gm)].map((m) => m[1]);
ok("no name in the namespace is defined twice",
   [...new Set(definitions.filter((n, i) => definitions.indexOf(n) !== i))], []);

/* A grimoire, in this rulebook, is a reference on one particular demon — pages
   of research towards summoning and binding it (p307). It is not a mage's book
   of spells, which the rules call a Spell Text. The word crept onto the magick
   tab, its heading and one of its labels, all meaning the wrong thing. */
const grimoireStrings = Object.entries(lang)
  .filter(([, text]) => typeof text === "string" && /grimoire/i.test(text))
  .map(([key]) => key);
ok("nothing calls a mage's spells a grimoire", grimoireStrings, []);

console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
