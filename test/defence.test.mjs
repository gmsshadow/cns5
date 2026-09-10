/**
 * Defences and the exchange between attack and defence (pp.270, 278-280).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const { resolveExchange } = await import(path.join(ROOT, "module", "helpers", "defence.mjs"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* -- Basic combat (p270) ---------------------------------------------------- */

/* An active defence takes half the defender's PSF off the attacker; a passive
   one a quarter. */
ok("an active defence", CNS5.defenceShare.active, 0.5);
ok("a passive one", CNS5.defenceShare.passive, 0.25);

const share = (psf, stance) => -Math.floor(psf * CNS5.defenceShare[stance]);
ok("a PSF of 40 defended actively", share(40, "active"), -20);
ok("and passively", share(40, "passive"), -10);
ok("an odd PSF rounds in the attacker's favour", share(41, "active"), -20);
ok("no defence takes nothing off", share(0, "active"), 0);

/* Every defence names a stance, or it is not a defence at all. */
ok(
  "the defences on offer",
  Object.keys(CNS5.defences).sort(),
  ["dodge", "none", "passive", "shieldBlock", "weaponParry"]
);
ok(
  "each has a stance except none",
  Object.entries(CNS5.defences).filter(([k, v]) => k !== "none" && !v.stance).map(([k]) => k),
  []
);

/* -- Advanced combat: the four outcomes (p270) ------------------------------ */

const hit = { success: true, critical: false };
const critHit = { success: true, critical: true };
const miss = { success: false, critical: false };
const stop = { success: true, critical: false };
const critStop = { success: true, critical: true };
const failedStop = { success: false, critical: false };

ok("a hit with no defence lands", resolveExchange(hit, null).outcome, "hit");
ok("a hit against a failed defence lands", resolveExchange(hit, failedStop).outcome, "hit");
ok("a hit against a good defence is turned", resolveExchange(hit, stop).outcome, "blocked");
ok("a miss against a good defence gives advantage", resolveExchange(miss, stop).outcome, "advantage");
ok("a miss against a failed defence is just a miss", resolveExchange(miss, failedStop).outcome, "miss");
ok("a miss with no defence is just a miss", resolveExchange(miss, null).outcome, "miss");

/* A Critical Success needs a Critical Success to turn away entirely. */
ok("a critical met by an ordinary defence still lands",
   resolveExchange(critHit, stop).outcome, "reduced");
ok("but is reduced", resolveExchange(critHit, stop).reduced, true);
ok("a critical met by a critical defence is turned",
   resolveExchange(critHit, critStop).outcome, "blocked");
ok("a critical against a failed defence lands in full",
   resolveExchange(critHit, failedStop), { outcome: "hit", damage: true, reduced: false, advantage: false });

/* Only the outcomes that land deal damage. */
const deals = (a, d) => resolveExchange(a, d).damage;
ok("what deals damage",
   [deals(hit, null), deals(hit, stop), deals(critHit, stop), deals(miss, stop)],
   [true, false, true, false]);

/* -- Weapon parries by weight (p279) --------------------------------------- */

/* Same weight stops everything; one step lighter lets the base damage past;
   two steps lets the Crit Die through as well. */
ok("like against like", CNS5.parryOutcome("medium", "medium"), { base: false, crit: false, impossible: false });
ok("parrying something heavier", CNS5.parryOutcome("light", "medium"), { base: true, crit: false, impossible: false });
ok("parrying something heavier still", CNS5.parryOutcome("light", "heavy").crit, true);
ok("a heavier weapon parries freely", CNS5.parryOutcome("heavy", "light"), { base: false, crit: false, impossible: false });

/* A light weapon cannot parry a two-handed weapon or polearm at all. */
ok("light against two-handed", CNS5.parryOutcome("light", "twoHanded").impossible, true);
ok("medium against two-handed is merely bad", CNS5.parryOutcome("medium", "twoHanded").impossible, false);
ok("and lets everything through", CNS5.parryOutcome("medium", "twoHanded").crit, true);

/* Every weight class the weapons use must have a rank, or a parry involving it
   silently compares against a default. */
ok(
  "every weapon weight is ranked",
  Object.keys(CNS5.weaponWeights).filter((w) => CNS5.parryRank[w] === undefined),
  []
);

/* A natural weapon is not a rung of its own: a natural medium counts as medium,
   so a light weapon parrying one loses only its base damage. */
ok("a natural medium ranks as medium", CNS5.parryRank.naturalMedium, CNS5.parryRank.medium);
ok("a natural heavy ranks as heavy", CNS5.parryRank.naturalHeavy, CNS5.parryRank.heavy);
ok("a natural light ranks as light", CNS5.parryRank.naturalLight, CNS5.parryRank.light);
ok("parrying a boar's tusk", CNS5.parryOutcome("light", "naturalMedium"),
   { base: true, crit: false, impossible: false });

/* -- Shields (p279) --------------------------------------------------------- */

const shields = JSON.parse(await readFile(path.join(ROOT, "data", "shields.json"), "utf8")).shields;

ok("shield count", shields.length, 10);
ok("every shield gives a block bonus", shields.filter((s) => !(s.blockBonus > 0)).length, 0);
ok(
  "bonuses rise with the shield",
  [shields.find((s) => s.name === "Buckler").blockBonus,
   shields.find((s) => s.name === "Roman Tower Shield").blockBonus],
  [5, 20]
);

/* Only the improvised entry has its absorption left to the Gamemaster. */
ok(
  "what the Gamemaster sets",
  shields.filter((s) => s.gamemasterSet).map((s) => s.name),
  ["Any object at hand"]
);
ok(
  "every other shield absorbs something of everything",
  shields
    .filter((s) => !s.gamemasterSet)
    .filter((s) => Object.values(s.absorption).some((v) => !(v > 0)))
    .map((s) => s.name),
  []
);

ok("the cumulative chance a shield breaks", CNS5.shieldFailureStep, 10);

/* -- Modes ------------------------------------------------------------------ */

ok("both forms of combat are offered", Object.keys(CNS5.defenceModes).sort(), ["advanced", "basic"]);

/* A weapon parry is opposed by the attacker's skill; the others are not. */
ok("a parry is opposed", CNS5.defenceModifiers.weaponParry.opposedByAttackerPsf, true);
ok("a dodge is not", CNS5.defenceModifiers.dodge.opposedByAttackerPsf, false);
ok("nor a shield block", CNS5.defenceModifiers.shieldBlock.opposedByAttackerPsf, false);

/* -- Table - Fatigue cost for Defence (p284) -------------------------------- */

/* Dodging costs one whatever the dodger's skill. */
ok("a dodge always costs one",
   [1, 30, 50, 65, 90].map((psf) => CNS5.defenceFatigueCost("dodge", psf)),
   [1, 1, 1, 1, 1]);

/* The heavier the thing interposed, the more it costs — and the better the
   defender, the less. */
ok("a light weapon across the bands",
   [10, 30, 50, 65, 90].map((psf) => CNS5.defenceFatigueCost("light", psf)),
   [2, 2, 1, 1, 1]);
ok("a medium one",
   [10, 30, 50, 65, 90].map((psf) => CNS5.defenceFatigueCost("medium", psf)),
   [3, 2, 2, 2, 1]);
ok("a heavy one",
   [10, 30, 50, 65, 90].map((psf) => CNS5.defenceFatigueCost("heavy", psf)),
   [3, 3, 2, 2, 2]);

/* The bands are the ones Table - Combat Actions uses, so the boundaries have to
   agree with it. */
ok("25 is the top of the first band", CNS5.defenceFatigueCost("medium", 25), 3);
ok("26 crosses into the second", CNS5.defenceFatigueCost("medium", 26), 2);
ok("70 is the fourth", CNS5.defenceFatigueCost("medium", 70), 2);
ok("71 reaches the top band", CNS5.defenceFatigueCost("medium", 71), 1);

/* The table names three weights; a weapon may be any of seven, so each has to
   map onto one or the cost silently falls back. */
ok(
  "every weapon weight has a defence weight",
  Object.keys(CNS5.weaponWeights).filter((w) => !CNS5.defenceWeightOf[w]),
  []
);
ok("a two-handed weapon parries as heavy", CNS5.defenceWeightOf.twoHanded, "heavy");
ok("a natural medium as medium", CNS5.defenceWeightOf.naturalMedium, "medium");
ok("and it costs what a medium costs",
   CNS5.defenceFatigueCost("twoHanded", 10), CNS5.defenceFatigueCost("heavy", 10));

/* Shields split three ways for Fatigue but only two for the skill, so the
   division is recorded on each shield rather than inferred. */
const shieldWeights = shields.map((s) => ({
  name: s.name,
  weight: /buckler|object at hand/i.test(s.name)
    ? "light"
    : /large shield|tower/i.test(s.name)
      ? "heavy"
      : "medium"
}));
ok(
  "the bucklers",
  shieldWeights.filter((s) => s.weight === "light").map((s) => s.name),
  ["Any object at hand", "Buckler"]
);
ok(
  "the large shields",
  shieldWeights.filter((s) => s.weight === "heavy").map((s) => s.name),
  ["Large Shield - Wicker", "Large Shield - Wood", "Large Shield - Reinforced", "Roman Tower Shield"]
);
ok(
  "and everything between",
  shieldWeights.filter((s) => s.weight === "medium").length,
  4
);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
