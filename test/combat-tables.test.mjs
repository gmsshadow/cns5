/**
 * Action Points, aimed shots, and the Acts of Faith data.
 */

import { readFile } from "node:fs/promises";
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

/* -- Table - Combat Actions (p271) ----------------------------------------- */

/* Costs fall as skill rises, so the bands run from most to least expensive. */
ok("a novice pays most for a medium weapon", CNS5.actionPointCost("attackMedium", 10), 9);
ok("PSF 25 is still the first band", CNS5.actionPointCost("attackMedium", 25), 9);
ok("PSF 26 crosses into the second", CNS5.actionPointCost("attackMedium", 26), 8);
ok("PSF 60 is the third band", CNS5.actionPointCost("attackMedium", 60), 7);
ok("PSF 61 is the fourth", CNS5.actionPointCost("attackMedium", 61), 6);
/* The printed bands leave 71-74% unstated; it is read into the top band. */
ok("PSF 71 falls in the top band", CNS5.actionPointCost("attackMedium", 71), 5);
ok("PSF 75 is the top band", CNS5.actionPointCost("attackMedium", 75), 5);

ok("a polearm costs one more than a heavy weapon at low skill",
   CNS5.actionPointCost("attackPolearm", 10) - CNS5.actionPointCost("attackHeavy", 10), 1);
ok("dropping a weapon is free", CNS5.actionPointCost("dropWeapon", 10), 0);
ok("a dodge always costs one", CNS5.actionPointCost("dodge", 90), 1);
ok("an arbalest is the slowest thing in the table",
   CNS5.actionPointCost("loadHeavyCrossbow", 10), 60);
ok("an unknown action has no cost", CNS5.actionPointCost("nonsense", 50), null);

/* Every row should get cheaper, or stay level, as skill rises. The medium
   crossbow is the exception: its fourth figure is printed as 12, below the
   band above it. That is preserved as printed, so it is named here rather
   than silently smoothed over. */
const notMonotonic = Object.entries(CNS5.combatActions)
  .filter(([, entry]) => entry.costs.some((c, i) => i > 0 && c > entry.costs[i - 1]))
  .map(([key]) => key);
ok("only the medium crossbow breaks the downward run", notMonotonic, ["loadMediumCrossbow"]);

ok("every action has one cost per band",
   Object.entries(CNS5.combatActions)
     .filter(([, e]) => e.costs.length !== CNS5.actionPointBands.length)
     .map(([k]) => k),
   []);

/* -- Weapon to action mapping ---------------------------------------------- */

const action = (w) => CNS5.weaponAttackAction(w);
ok("a medium sword", action({ role: "melee", weightClass: "medium", group: "Slashing Swords" }), "attackMedium");
ok("a two-handed sword uses the heavy row",
   action({ role: "melee", weightClass: "twoHanded", group: "Great Swords" }), "attackHeavy");
ok("a polearm has its own row",
   action({ role: "melee", weightClass: "twoHanded", group: "Polearms" }), "attackPolearm");
ok("a thrown javelin", action({ role: "melee", missile: true, weightClass: "medium", group: "War Spears" }), "throwWeapon");
ok("a bow", action({ role: "launcher", group: "" , name: "Longbow" }), "fireBow");
ok("a crossbow", action({ role: "launcher", group: "", name: "Light Crossbow" }), "fireCrossbow");
ok("a sling", action({ role: "launcher", group: "Sling", name: "Shepherds" }), "fireSling");

/* Natural weapons have their own rows, and the Attacker's Bonus table pairs a
   natural medium with a light and a natural heavy with a medium. */
ok("a boar's tusk", action({ role: "melee", weightClass: "naturalMedium", group: "" }), "attackNaturalMedium");
ok("a bear's claws", action({ role: "melee", weightClass: "naturalHeavy", group: "" }), "attackNaturalHeavy");
ok("natural medium shares the light column",
   CNS5.weaponWeights.naturalMedium.column, CNS5.weaponWeights.light.column);
ok("natural heavy shares the medium column",
   CNS5.weaponWeights.naturalHeavy.column, CNS5.weaponWeights.medium.column);

/* -- Table - Aimed Shot Modifiers (p272) ----------------------------------- */

ok("the chest is the unaimed default", CNS5.aimedShotModifiers.chest.modifier, 0);
ok("the head", CNS5.aimedShotModifiers.head.modifier, -40);
ok("the eyes are the hardest target", CNS5.aimedShotModifiers.eyes.modifier, -60);
ok("no modifier is positive",
   Object.values(CNS5.aimedShotModifiers).filter((a) => a.modifier > 0).length, 0);

/* -- Acts of Faith (pp.145-146) -------------------------------------------- */

const faith = JSON.parse(await readFile(path.join(ROOT, "data", "acts-of-faith.json"), "utf8"));
const acts = faith.acts;

ok("act count matches header", acts.length, faith.count);
ok("act count", acts.length, 47);

/* The tick and cross are printed on every row for every vocation, so a row
   carrying fewer than six marks was read wrongly. */
ok("every row carries six marks",
   acts.filter((a) => a.marksFound !== 6).map((a) => a.name), []);

ok("every act has a name and a minimum",
   acts.filter((a) => !a.name?.trim() || !(a.pffMinimum > 0)).map((a) => a.name), []);

ok("every act is available to someone",
   acts.filter((a) => !a.vocations.length).map((a) => a.name), []);

ok("every act sits in a section",
   acts.filter((a) => !a.section).map((a) => a.name), []);

/* Three entries print no minimum of their own and inherit from the row above. */
ok("the entries inheriting a minimum",
   acts.filter((a) => a.pffInherited).map((a) => a.name),
   ["Last Rites", "Anointing the Sick", "Anointing the Wounded"]);

/* The core prayers are open to every vocation — that is what makes them core. */
ok("the core prayers are open to all six",
   acts
     .filter((a) => a.section === "Core Acts of Faith: Prayers" && a.vocations.length !== 6)
     .map((a) => a.name),
   []);

console.log(`\n${acts.length} Acts of Faith across ${new Set(acts.map((a) => a.section)).size} groups`);
console.log(fails ? `${fails} FAILURES` : "All checks passed.");
process.exit(fails ? 1 : 0);
