/**
 * Falling and dying (p282).
 *
 * "Once a character reaches zero body he slips into unconsciousness. A
 * character can suffer damage that places his body into negative figures, but
 * once this happens death may rapidly follow. When the character's Body Points
 * reach a negative figure equal to the level of the character's Constitution,
 * the character is dead."
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const state = (body, con) => CNS5.vitalState(body, con).state;

/* -- Where the lines fall ---------------------------------------------------- */

/* A man of Constitution 14 falls at nought and dies at fourteen below it. */
ok("on his feet at one", state(1, 14), "standing");
ok("down at nought", state(0, 14), "unconscious");
ok("still only down at thirteen below", state(-13, 14), "unconscious");
ok("dead at fourteen below", state(-14, 14), "dead");
ok("and no less dead beyond it", state(-30, 14), "dead");

/* The margin is the character's own Constitution, so a hardy man has further
   to go — which is the whole point of measuring it against that attribute. */
ok("a hardy man's death threshold", CNS5.deathThreshold(18), -18);
ok("a frail one's", CNS5.deathThreshold(6), -6);
ok("the hardy man survives what kills the frail one", state(-10, 18), "unconscious");
ok("while the frail one is dead", state(-10, 6), "dead");

/* -- What is left ------------------------------------------------------------ */

const left = (body, con) => CNS5.vitalState(body, con).margin;
ok("a standing man's margin counts from death", left(10, 14), 24);
ok("a fallen man's", left(0, 14), 14);
ok("one nearly gone", left(-13, 14), 1);
ok("and a dead one has none", left(-14, 14), 0);
ok("nor does one beyond", left(-40, 14), 0);

/* -- Edges -------------------------------------------------------------------- */

/* A Constitution of nought would mean falling and dying at the same moment,
   which is what the rule says rather than something to be smoothed over. */
ok("no constitution at all", state(0, 0), "dead");

/* Body is not floored at zero. The distance below it is the only thing that
   decides the question, so flooring it would throw that away. */
const wounded = CNS5.vitalState(-9, 14);
ok("a wound below zero is kept", wounded.margin, 5);
ok("and the character is not yet dead", wounded.dead, false);
ok("but is dying", wounded.dying, true);

/* Standing is neither. */
const well = CNS5.vitalState(20, 14);
ok("a well man is not dying", [well.dying, well.dead], [false, false]);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
