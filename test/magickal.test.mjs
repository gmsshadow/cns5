/**
 * Magickal items (pp.302-305).
 *
 * A Focus is an aid a spell is cast *through*; a Device holds spells and the
 * charges to cast them. Both carry their maker's Magick Level with them.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const { resolveTargeting } = await import(path.join(ROOT, "module", "helpers", "targeting.mjs"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const focus = CNS5.focusGrades;

/* -- What a Focus gives (pp.304-305) ------------------------------------------ */

ok("skill in the school", ["simple", "lesser", "greater"].map((g) => focus[g].psf), [7, 13, 26]);
ok("aim", ["simple", "lesser", "greater"].map((g) => focus[g].targeting), [5, 10, 15]);
ok("what each may store, per level", ["simple", "lesser", "greater"].map((g) => focus[g].storedMrPerMl), [3, 7, 13]);
ok("and the charges it holds", ["simple", "lesser", "greater"].map((g) => focus[g].chargesPerMl), [3, 7, 13]);
ok("weeks to make", ["simple", "lesser", "greater"].map((g) => focus[g].constructionWeeks), [3, 7, 13]);
ok("the least Magick Level to make one", ["simple", "lesser", "greater"].map((g) => focus[g].minimumMl), [0, 3, 6]);

/* Losing one costs more the better it was. */
ok("the cost of losing one", ["simple", "lesser", "greater"].map((g) => focus[g].lossPenalty), [-14, -26, -42]);
ok("and only a Greater one is felt harder when destroyed",
   ["simple", "lesser", "greater"].map((g) => focus[g].destroyedConPenalty), [0, 0, -26]);

/* A Greater one recharges daily, the others weekly. */
ok("recharging", ["simple", "lesser", "greater"].map((g) => focus[g].recharge.every), ["week", "week", "day"]);

/* -- What a Focus does to the cost -------------------------------------------- */

/* "Reduced by -2 FP", "halved", "quartered" — and "the minimum cost is always
   1 FP". */
ok("a Simple Focus takes two off", CNS5.focusFatigue(7, "simple"), 5);
ok("a Lesser halves it, rounding up", CNS5.focusFatigue(7, "lesser"), 4);
ok("a Greater quarters it", CNS5.focusFatigue(7, "greater"), 2);
ok("never below one", CNS5.focusFatigue(2, "simple"), 1);
ok("even from one", CNS5.focusFatigue(1, "greater"), 1);
ok("and no Focus changes nothing", CNS5.focusFatigue(7, null), 7);

/* It comes last, lightening whatever else has made the cost. */
const through = (options) => CNS5.spellCost({ base: 8, ...options }).fatigue;
ok("in a low mana place, doubled then halved", through({ mana: "low", focus: "lesser" }), 8);
ok("from a scroll, halved then quartered", through({ source: "scroll", focus: "greater" }), 1);
ok("and the cost before it is kept", CNS5.spellCost({ base: 8, focus: "simple" }).beforeFocus, 8);

/* It is no longer a casting source: a spell is cast through a Focus from
   memory, not read from it. */
ok("a Focus is not a source", "focus" in CNS5.castingSources, false);

/* -- What a Focus does to the chance ------------------------------------------ */

/* Both bonuses bear on the targeting roll. */
ok("a Greater Focus in the open",
   resolveTargeting({ methodTsc: 50, focusBonus: focus.greater.psf + focus.greater.targeting }).total,
   91);
ok("without one", resolveTargeting({ methodTsc: 50 }).total, 50);

/* -- Devices (pp.303-304) ---------------------------------------------------- */

const device = CNS5.deviceGrades;
ok("charges per level", ["simple", "lesser", "greater"].map((g) => device[g].chargesPerMl), [4, 13, 21]);

/* Charges follow the maker, not the bearer. */
ok("a Simple Device by a sixth-level mage", CNS5.itemCharges("device", "simple", 6), 24);
ok("a Greater one", CNS5.itemCharges("device", "greater", 6), 126);
ok("and a Greater Focus", CNS5.itemCharges("focus", "greater", 6), 78);

/* A Simple Device: "a single spell up to MR 7". */
const accepts = (grade, mrs, ml = 5) => CNS5.deviceAccepts(grade, mrs, ml).allowed;
ok("one spell of seven", accepts("simple", [7]), true);
ok("but not of eight", accepts("simple", [8]), false);
ok("nor two spells", accepts("simple", [2, 2]), false);

/* A Lesser Device: "up to 13 spells with a total of MR 21 with no spell having
   a MR of 7 or higher" — so six at most, a lower ceiling than the Simple
   Device's, which is easy to get backwards. */
ok("thirteen spells of one", accepts("lesser", Array(13).fill(1)), true);
ok("but not fourteen", accepts("lesser", Array(14).fill(1)), false);
ok("a spell of six", accepts("lesser", [6]), true);
ok("but not of seven", accepts("lesser", [7]), false);
ok("three of six and one of three", accepts("lesser", [6, 6, 6, 3]), true);
ok("but not one of four", accepts("lesser", [6, 6, 6, 4]), false);

/* A Greater Device: "any amount of spells up to a total MR of 21 x ML... with
   no MR limit". */
ok("any number", accepts("greater", Array(40).fill(1)), true);
ok("of any strength", accepts("greater", [20]), true);
ok("up to twenty-one a level", accepts("greater", [105], 5), true);
ok("and no further", accepts("greater", [106], 5), false);

/* Empowering: "(7 / ML) hours x the Spell MR", in sittings of ten hours. */
ok("an MR 4 spell at ML 5", CNS5.empoweringHours(4, 5).hours, 5.6);
ok("in one sitting", CNS5.empoweringHours(4, 5).sittings, 1);
ok("a long one at ML 1", CNS5.empoweringHours(7, 1).hours, 49);
ok("takes five sittings", CNS5.empoweringHours(7, 1).sittings, 5);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
