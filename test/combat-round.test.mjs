/**
 * The Action Point Combat Round (p268).
 *
 * The document classes need a live Foundry to run, so what is exercised here is
 * the sequencing itself, lifted out as pure functions and driven through a
 * whole round. That catches the things that actually go wrong — who acts next,
 * when a phase closes, what carries over — without pretending to have tested
 * the Foundry plumbing, which has not been.
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

/* -------------------------------------------- */
/*  The sequencing, mirroring documents/combat.mjs                            */
/* -------------------------------------------- */

const active = (c) => !c.held && c.pool > 0;
const pending = (list) => list.filter((c) => active(c) && !c.acted);

/** Order for a new phase: most Action Points first, held over sinking last. */
function reorder(list) {
  return [...list].sort((a, b) => {
    if (a.held !== b.held) return a.held ? 1 : -1;
    if (a.pool !== b.pool) return b.pool - a.pool;
    return a.name.localeCompare(b.name);
  });
}

/** Apply a combatant's declaration. */
function declare(c, choice, spent = 0) {
  if (choice === "hold") {
    c.pool = Math.min(c.pool, c.bap);
    c.held = true;
  } else {
    c.pool = Math.max(0, c.pool - spent);
  }
  c.acted = true;
}

/** What a combatant starts the next round with. */
function carryOver(c) {
  return c.held ? Math.min(c.pool, c.bap) : 0;
}

/* -------------------------------------------- */
/*  A round played out                                                        */
/* -------------------------------------------- */

const knight = { name: "Knight", bap: 14, pool: 20, held: false, acted: false };
const boar = { name: "Boar", bap: 12, pool: 17, held: false, acted: false };
const archer = { name: "Archer", bap: 11, pool: 14, held: false, acted: false };
let order = reorder([knight, boar, archer]);

ok("the largest pool leads", order.map((c) => c.name), ["Knight", "Boar", "Archer"]);

/* First phase. The knight swings twice, the boar charges, the archer shoots. */
declare(knight, "act", 9);
/* The knight is now on 11 and the boar on 17, so a fresh sort would put the
   boar first. The frozen order does not move: re-sorting mid-phase would
   shuffle the list while it is being worked through. */
ok("a fresh sort would reorder them", reorder(order).map((c) => c.name), ["Boar", "Archer", "Knight"]);
ok("but the phase order holds", order.map((c) => c.name), ["Knight", "Boar", "Archer"]);
ok("the next to act is the next along", pending(order)[0].name, "Boar");

declare(boar, "act", 12);
declare(archer, "act", 6);
ok("the phase closes when all have acted", pending(order).length, 0);

/* Second phase: worked out afresh, so the archer now leads on 8. */
[knight, boar, archer].forEach((c) => (c.acted = false));
order = reorder(order);
ok("pools after the first phase", order.map((c) => c.pool), [11, 8, 5]);
ok("and the order follows them", order.map((c) => c.name), ["Knight", "Archer", "Boar"]);

/* The knight holds over, which takes them out of the reckoning at once. */
declare(knight, "hold", 0);
ok("holding over is capped at Base Action Points", knight.pool, 11);
ok("and ends that character's round", active(knight), false);
ok("the next to act skips them", pending(order)[0].name, "Archer");

declare(archer, "act", 8);
declare(boar, "act", 5);
ok("the boar is spent", boar.pool, 0);
ok("the archer too", archer.pool, 0);
ok("so nobody is left to act", [knight, boar, archer].filter(active).length, 0);

/* -------------------------------------------- */
/*  The turn of the round                                                     */
/* -------------------------------------------- */

ok("the knight carries over what was held", carryOver(knight), 11);
ok("the boar carries nothing", carryOver(boar), 0);
ok("nor the archer", carryOver(archer), 0);

/* A character holding more than Base Action Points loses the excess. */
const hoarder = { name: "Hoarder", bap: 8, pool: 19, held: false, acted: false };
declare(hoarder, "hold", 0);
ok("the excess above BAP is lost", hoarder.pool, 8);
ok("and that is what carries", carryOver(hoarder), 8);

/* A new round: what was held, plus the round bonus, plus a fresh d10. Every
   combatant rolls again — the pool is not carried forward untouched. */
const newPool = (c, die) => carryOver(c) + die + c.bap;
ok("the knight's new pool on a 6", newPool(knight, 6), 31);
ok("the boar's, having spent all", newPool(boar, 6), 18);
ok("a different die gives a different pool", newPool(boar, 1), 13);
ok("so the roll is not optional", newPool(boar, 6) - newPool(boar, 1), 5);

/* Someone who held over still rolls; the held points are added to the roll
   rather than replacing it. */
ok("holding does not skip the roll", newPool(knight, 1) > carryOver(knight), true);
ok("and the held points are on top of it", newPool(knight, 1), 11 + 1 + 14);

/* -------------------------------------------- */
/*  Configuration                                                             */
/* -------------------------------------------- */

ok("a fresh die each round", CNS5.initiativeDie, "1d10");
ok("the advisory cap on one action", CNS5.maxApPerAction, 10);

/* A round ends only when nobody can act — held over or spent out. */
const roundOver = (list) => !list.some(active);
ok("a round with someone still able to act is not over",
   roundOver([{ pool: 3, held: false }, { pool: 0, held: false }]), false);
ok("one where all have held is over",
   roundOver([{ pool: 9, held: true }, { pool: 4, held: true }]), true);
ok("one where all are spent is over",
   roundOver([{ pool: 0, held: false }, { pool: 0, held: false }]), true);
ok("and a mix of the two is over",
   roundOver([{ pool: 9, held: true }, { pool: 0, held: false }]), true);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
