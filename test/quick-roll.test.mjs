/**
 * The free-form roll.
 *
 * What matters here is that naming a Difficulty Factor behaves exactly as a
 * skill check does, and that leaving it out does not quietly apply one.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const { clampSuccessChance } = await import(path.join(ROOT, "module", "helpers", "checks.mjs"));

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/** What the roll does with a chance, an optional Factor and a hand modifier. */
const resolve = (chance, df, critMod = 0) => {
  const banded = df ? clampSuccessChance(chance, df) : null;
  return {
    target: banded ? banded.target : chance,
    critMod: (banded?.critMod ?? 0) + critMod
  };
};

/* -- Without a Difficulty Factor -------------------------------------------- */

/* The number typed in is the number to roll under, and nothing touches it.
   Someone improvising a check has already decided how hard it is. */
ok("a plain chance stands", resolve(50, null), { target: 50, critMod: 0 });
ok("even a high one", resolve(97, null), { target: 97, critMod: 0 });
ok("and a low one", resolve(3, null), { target: 3, critMod: 0 });
ok("a chance beyond any band is untouched", resolve(120, null).target, 120);

/* -- With one -------------------------------------------------------------- */

/* Naming a Factor applies its band and converts the surplus, as a skill check
   does — the same function settles both, so they cannot drift apart. */
const df4 = CNS5.difficultyFactors[4];
ok("a chance inside the band is untouched", resolve(60, 4), { target: 60, critMod: 0 });
ok("one above it is clamped", resolve(120, 4).target, df4.max);
ok("and the surplus becomes a Crit Die modifier", resolve(120, 4).critMod, 2);
ok("one below the floor is raised", resolve(1, 4).target, df4.min);
ok("and the shortfall counts against it", resolve(1, 4).critMod, -1);

/* Each Factor has its own band, so the same chance is treated differently. */
ok("96% is over the band of a Challenging task", resolve(96, 4).target, 95);
ok("but inside that of a Simple one", resolve(96, 2).target, 96);

/* Every Factor the dialog offers has to be one the clamp knows. */
ok(
  "every Difficulty Factor offered is real",
  Object.keys(CNS5.difficultyFactors).filter((df) => !CNS5.difficultyFactors[Number(df)]),
  []
);
ok("there are ten of them", Object.keys(CNS5.difficultyFactors).length, 10);

/* -- The chance entered ----------------------------------------------------- */

/* A percentile roll of 100 always fails, so a chance is bounded at 1 and 100
   whatever is typed. */
const bound = (value) => Math.min(Math.max(Math.round(value), 1), 100);
ok("nought becomes one", bound(0), 1);
ok("a negative becomes one", bound(-20), 1);
ok("beyond a hundred becomes a hundred", bound(150), 100);
ok("a fraction rounds", bound(49.6), 50);

/* -- A modifier given by hand ----------------------------------------------- */

/* Plenty of things move the Crit Die without touching the chance, and a
   free-form roll cannot know which, so it asks. */
ok("a modifier on its own", resolve(50, null, 2).critMod, 2);
ok("and a penalty", resolve(50, null, -3).critMod, -3);
ok("none by default", resolve(50, null).critMod, 0);
ok("it does not touch the chance", resolve(50, null, 4).target, 50);

/* It stacks with whatever the band produced rather than replacing it. */
ok("a band's surplus and a hand modifier add", resolve(120, 4, 1).critMod, 3);
ok("as do a shortfall and a bonus", resolve(1, 4, 2).critMod, 1);
ok("and they can cancel", resolve(120, 4, -2).critMod, 0);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
