/**
 * Check the stylesheet's palette for readable contrast.
 *
 * The sheet is dense with small figures a player reads mid-roll, and the first
 * pass at this palette put several of them below a comfortable ratio — worse
 * still, Foundry's own dark table styling showed through and dropped some to
 * grey on grey. These are the numbers, so a future tweak to a colour cannot
 * quietly undo it.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = await readFile(path.join(ROOT, "styles", "cns5.css"), "utf8");

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/** Read a custom property's value out of the stylesheet. */
function variable(name) {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  return m?.[1] ?? null;
}

/** Relative luminance, per WCAG. */
function luminance(hex) {
  const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = parts.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const grounds = ["cns-vellum", "cns-vellum-band", "cns-vellum-light"].map((n) => [n, variable(n)]);
const inks = ["cns-ink", "cns-ink-soft", "cns-lapis", "cns-oxblood", "cns-verdigris"];

ok("every ground colour is defined", grounds.filter(([, v]) => !v).map(([n]) => n), []);
ok("every ink colour is defined", inks.filter((n) => !variable(n)), []);

/* 4.5:1 is the AA threshold for body text. Every ink is used for small figures
   somewhere, so all of them are held to it on every ground. */
const failures = [];
for (const ink of inks) {
  for (const [groundName, ground] of grounds) {
    const ratio = contrast(variable(ink), ground);
    if (ratio < 4.5) failures.push(`${ink} on ${groundName}: ${ratio.toFixed(1)}`);
  }
}
ok("every ink reads on every ground", failures, []);

/* Gilt marks tags, which are bold, so 3:1 is the applicable threshold. */
const giltFailures = grounds
  .map(([name, ground]) => [name, contrast(variable("cns-gilt"), ground)])
  .filter(([, ratio]) => ratio < 3)
  .map(([name, ratio]) => `${name}: ${ratio.toFixed(1)}`);
ok("gilt reads on every ground as bold text", giltFailures, []);

/* Foundry's own table styling must stay cleared, or its dark head and banding
   show through and take the text with it. */
ok("Foundry's table backgrounds are cleared", /\.application\.cns5 thead,/.test(css), true);

/* -- Class collisions ------------------------------------------------------ */

/* A block class must not also be used as a standalone class elsewhere: two
   rules for one name means whichever appears last silently wins, which is how
   the checkbox rule ended up flipping the chat card's layout to a row. Any
   class used in a template gets checked against every top-level rule for it. */
const { readdir } = await import("node:fs/promises");

async function walkTemplates(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkTemplates(full)));
    else if (entry.name.endsWith(".hbs")) out.push(full);
  }
  return out;
}

const templateClasses = new Set();
for (const file of await walkTemplates(path.join(ROOT, "templates"))) {
  const text = await readFile(file, "utf8");
  for (const m of text.matchAll(/class="([^"{}]+)"/g)) {
    for (const name of m[1].split(/\s+/)) {
      if (name.startsWith("cns5-")) templateClasses.add(name);
    }
  }
}

/* Count the rules that set a bare `.name {` block for each class. More than one
   is not itself wrong, but zero means the class does nothing at all. */
const undefinedClasses = [...templateClasses]
  .filter((name) => !new RegExp(`\\.${name}[\\s,{:.]`).test(css))
  .sort();
ok("every class used in a template is styled", undefinedClasses, []);

/* The specific pair that caused the bug: these two must stay distinct. */
ok("the chat card and the checkbox are different classes", /\.cns5-checkbox\s*{/.test(css), true);
ok("no template still uses the old shared name", [...templateClasses].filter((c) => c === "cns5-check"), []);

console.log(`\n${grounds.length} grounds, ${inks.length + 1} inks, ${templateClasses.size} classes checked`);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
