/**
 * Structural checks on the Handlebars templates.
 *
 * Two rules here are enforced by Foundry at render time rather than by anything
 * a linter would catch, and both fail with an error that names the part rather
 * than the mistake:
 *
 *   - a part must render exactly one root element, or the render throws;
 *   - a template must not open its own form, because DocumentSheetV2 already
 *     renders the sheet element as one, and a nested form silently stops
 *     ApplicationV2 collecting the fields.
 *
 * Both have bitten once. Neither should again.
 */

import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

async function walk(dir, ext) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, ext)));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

/* -------------------------------------------- */

/** Templates named in a PARTS block are rendered as parts and must have one root. */
const partPaths = new Set();
for (const file of await walk(path.join(ROOT, "module"), ".mjs")) {
  const text = await readFile(file, "utf8");
  for (const m of text.matchAll(/template:\s*"systems\/cns5\/(templates\/[^"]+)"/g)) {
    partPaths.add(m[1]);
  }
}

ok("some parts were found to check", partPaths.size > 0, true);

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr"
]);

/**
 * Count the root-level elements in a template.
 *
 * Handlebars expressions and comments are stripped first, then tags are walked
 * tracking depth. Every time the depth returns to zero one root has closed, so
 * the count of those is the number of roots.
 *
 * @param {string} html
 * @returns {number}
 */
function countRoots(html) {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\{![\s\S]*?\}\}/g, "")
    .replace(/\{\{[\s\S]*?\}\}/g, "");

  let depth = 0;
  let roots = 0;
  for (const m of stripped.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g)) {
    const [, closing, tag, rest] = m;
    const name = tag.toLowerCase();
    if (VOID.has(name) || rest.trimEnd().endsWith("/")) {
      if (depth === 0) roots += 1;
      continue;
    }
    if (closing) {
      depth -= 1;
      if (depth === 0) roots += 1;
    } else {
      depth += 1;
    }
  }
  return roots;
}

const multiRoot = [];
for (const relative of [...partPaths].sort()) {
  const full = path.join(ROOT, relative);
  let html;
  try {
    html = await readFile(full, "utf8");
  } catch {
    multiRoot.push(`${relative} (missing)`);
    continue;
  }
  const roots = countRoots(html);
  if (roots !== 1) multiRoot.push(`${relative}: ${roots} roots`);
}
ok("every part renders a single root element", multiRoot, []);

/* -------------------------------------------- */

const nested = [];
for (const file of await walk(path.join(ROOT, "templates"), ".hbs")) {
  if (/<form\b/.test(await readFile(file, "utf8"))) nested.push(path.relative(ROOT, file));
}
ok("no template opens its own form", nested, []);

/* -------------------------------------------- */

/** Every template referenced from code must exist. */
const missing = [];
for (const relative of partPaths) {
  try {
    await readFile(path.join(ROOT, relative), "utf8");
  } catch {
    missing.push(relative);
  }
}
ok("every referenced template exists", missing.sort(), []);

/* -------------------------------------------- */

/* A derived field and the override that feeds it are easy to confuse, and the
   sheet showed the override — always zero — where the derived Action Point
   cost belonged. These are the pairs where the wrong one renders as a plausible
   number rather than as nothing, so a mistake is invisible. */
const derivedPairs = [
  { wrong: "system.apCost", right: "system.ap", what: "weapon Action Points" },
  { wrong: "system.pcCost}}", right: "system.pcCost", what: "talent cost" }
];

const sheets = (await walk(path.join(ROOT, "templates", "actor"), ".hbs"));
const misrendered = [];
for (const file of sheets) {
  const text = await readFile(file, "utf8");
  if (/\{\{weapon\.system\.apCost\}\}/.test(text)) {
    misrendered.push(`${path.relative(ROOT, file)}: shows the AP override, not the derived cost`);
  }
}
ok("no sheet shows an override where the derived figure belongs", misrendered, []);

/* -------------------------------------------- */

/* A test file that never sets an exit code passes whatever happens, and the
   suite is chained with &&, so one such file hides every failure after it. */
const suites = (await walk(path.join(ROOT, "test"), ".mjs"));
const toothless = [];
for (const file of suites) {
  const text = await readFile(file, "utf8");
  if (!/process\.exit\(/.test(text)) toothless.push(path.relative(ROOT, file));
}
ok("every test suite can fail the build", toothless, []);

/* -------------------------------------------- */

/* Every kind of item has to be visible somewhere on an actor, or it can be
   dragged onto a character and simply vanish — which looks exactly like a drop
   that failed. Ammunition did this: the type was registered, the compendium
   built, the item created, and nothing on the sheet ever listed it. */
const manifest = JSON.parse(await readFile(path.join(ROOT, "system.json"), "utf8"));
const itemTypes = Object.keys(manifest.documentTypes.Item);

const actorTemplates = await walk(path.join(ROOT, "templates", "actor"), ".hbs");
let actorMarkup = "";
for (const file of actorTemplates) actorMarkup += await readFile(file, "utf8");

const sheetFiles = await walk(path.join(ROOT, "module", "sheets"), ".mjs");
let sheetCode = "";
for (const file of sheetFiles) sheetCode += await readFile(file, "utf8");

const invisible = itemTypes.filter(
  (type) =>
    !actorMarkup.includes(`data-type="${type}"`) &&
    !sheetCode.includes(`"${type}"`)
);
ok("every item type is surfaced on an actor sheet", invisible, []);

/* And every kind has a sheet body, or opening one shows an empty frame. The
   map is read from the sheet rather than guessed from the type name, since the
   files are named as words and the types as identifiers. */
const sheetSource = await readFile(
  path.join(ROOT, "module", "sheets", "item-sheet.mjs"),
  "utf8"
);
const mapped = new Set(
  [...sheetSource.matchAll(/^\s*(\w+):\s*"systems\/cns5\/templates\/item\/[^"]+"/gm)]
    .map((m) => m[1])
);
// The skill sheet is an application of its own rather than a body partial.
mapped.add("skill");

ok("every item type has a sheet body", itemTypes.filter((t) => !mapped.has(t)), []);

const bodyFiles = [];
for (const m of sheetSource.matchAll(/"systems\/cns5\/(templates\/item\/[^"]+)"/g)) {
  try {
    await readFile(path.join(ROOT, m[1]), "utf8");
  } catch {
    bodyFiles.push(m[1]);
  }
}
ok("and every body it names exists", bodyFiles, []);

/* -------------------------------------------- */

/* A row's name is what a player clicks to use the thing. Where a thing can be
   rolled, its name rolls it and editing is a button among the controls — the
   magick tab once had this the other way round, so clicking a spell opened its
   editor and casting meant finding one of three small numbers further along.

   Stated as what each rollable list must do, rather than as what no list may:
   plenty of rows have nothing to roll, and their names rightly open an editor. */
const rollable = [
  ["parts/magick.hbs", "rollSpell"],
  ["parts/core-combat.hbs", "rollWeapon"],
  ["parts/skills.hbs", "rollSkill"],
  ["parts/faith.hbs", "rollActOfFaith"]
];

const notRollable = [];
for (const [file, action] of rollable) {
  const text = await readFile(path.join(ROOT, "templates", "actor", file), "utf8");
  // The name cell of a row, and the first button inside it.
  const cells = [...text.matchAll(/<th scope="row">([\s\S]*?)<\/th>/g)];
  const rolls = cells.some((cell) => {
    const first = /<button[^>]*data-action="(\w+)"/.exec(cell[1]);
    return first?.[1] === action;
  });
  if (!rolls) notRollable.push(`${file} should roll ${action} from a row's name`);
}
ok("every rollable list rolls from the name", notRollable, []);

/* And every row's name does *something*. An ammunition row's name was plain
   text: clicking it did nothing at all, with nothing to say why. A name that
   cannot be rolled opens its item, which is the next most useful thing and what
   the other lists do. */
const actorTemplateFiles = await walk(path.join(ROOT, "templates", "actor"), ".hbs");
const inert = [];
for (const file of actorTemplateFiles) {
  const text = await readFile(file, "utf8");
  for (const cell of text.matchAll(/<th scope="row">([\s\S]*?)<\/th>/g)) {
    const named = /\{\{(\w+)\.name\}\}/.exec(cell[1]);
    if (named && !/<button[^>]*data-action=/.test(cell[1])) {
      inert.push(`${path.relative(ROOT, file)}: ${named[1]}`);
    }
  }
}
ok("no row's name is inert", inert, []);


console.log(`\n${partPaths.size} parts checked`);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
