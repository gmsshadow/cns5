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

console.log(`\n${partPaths.size} parts checked`);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
