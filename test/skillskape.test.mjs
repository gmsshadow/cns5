import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { CNS5 } from "../module/config.mjs";
import { clampSuccessChance } from "../module/helpers/checks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillList = JSON.parse(
  await readFile(path.join(ROOT, "data", "skills.json"), "utf8")
).skills;

let fails = 0;
const ok = (label, got, want) => {
  const pass = JSON.stringify(got) === JSON.stringify(want);
  if (!pass) fails++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

/* Stephen the carpenter (p34): PSF 17%, Carpentry DF4 skilled BCS 30% -> TSC 47% */
const df4 = CNS5.difficultyFactors[4];
ok("Stephen TSC", df4.skilled + 17, 47);
/* The book prints this as 12%, but 30 + 17 - 25 is 22. Arithmetic error in
   the rulebook; the stated sum is right and the stated total is wrong. */
ok("Stephen in the dark (-25%)", df4.skilled + 17 - 25, 22);
ok("Stephen with good light (+7%)", df4.skilled + 17 + 7, 54);

/* Rolf climbing (p36): PSF 40%, Climbing DF3 BCS 40% -> 80%, then -20 -20 -8 */
const df3 = CNS5.difficultyFactors[3];
ok("Rolf base TSC", df3.skilled + 40, 80);
ok("Rolf after penalties", df3.skilled + 40 - 20 - 20, 40);

/* Roderick the physician (p38): PSF 82%, Chirurgery DF4 mastered, +25% situational.
   TSC = 30 + 82 + 25 = 137. Max 95. Surplus 42 -> crit modifier +3.        */
const roderick = clampSuccessChance(30 + 82 + 25, 4);
ok("Roderick target", roderick.target, 95);
ok("Roderick overflow", roderick.overflow, 42);
ok("Roderick crit modifier", roderick.critMod, 3);
/* He rolls 36 (success) and 8 on the Crit Die, raised to 11 -> Critical */
ok("Roderick crit total", 8 + roderick.critMod, 11);
ok("Roderick outcome", CNS5.critOutcome(8 + roderick.critMod, true), "critical");

/* Roderick disturbed (p39): -25% brings TSC to 112. Surplus 17 -> +1. */
const roderick2 = clampSuccessChance(137 - 25, 4);
ok("Roderick disturbed target", roderick2.target, 95);
ok("Roderick disturbed overflow", roderick2.overflow, 17);
ok("Roderick disturbed crit modifier", roderick2.critMod, 1);

/* Thomas brewing (p38): Brewing DF3, PSF 0%, -40% situational -> TSC 0%.
   The book's example says the minimum is 4%, but 4% is the DF4 minimum; the
   Difficulty Factor table gives 5% for DF3. We follow the table.            */
const thomas = clampSuccessChance(df3.skilled + 0 - 40, 3);
ok("Thomas target (DF3 min per table)", thomas.target, 5);
ok("Thomas shortfall", thomas.shortfall, 5);
ok("Thomas crit modifier", thomas.critMod, -1);
/* He rolls 61, a failure, Crit Die 4 worsened by 1 to 5 -> Disappointing */
ok("Thomas crit total", 4 - thomas.critMod, 5);
ok("Thomas outcome", CNS5.critOutcome(4 - thomas.critMod, false), "disappointing");

/* The book's own arithmetic, reproduced with its DF4 minimum, to show the
   engine matches it exactly when given the same band.                       */
const thomasAsPrinted = clampSuccessChance(0, 4);
ok("Thomas as printed (DF4 min 4%)", thomasAsPrinted.critMod, -1);

/* Band edges: exactly at Max or Min produces no Crit Die modifier. */
ok("exactly at max", clampSuccessChance(95, 4), { target: 95, critMod: 0, overflow: 0, shortfall: 0 });
ok("exactly at min", clampSuccessChance(4, 4), { target: 4, critMod: 0, overflow: 0, shortfall: 0 });
ok("1% over max rounds up to +1", clampSuccessChance(96, 4).critMod, 1);
ok("20% over max is still +1", clampSuccessChance(115, 4).critMod, 1);
ok("21% over max becomes +2", clampSuccessChance(116, 4).critMod, 2);

/* PSF assembly (p34): Stephen STR 13 (+1) and AGL 12 (+0) = +1 for Short Sword;
   Sue STR 11 (+0) and AGL 16 (+4) = +4.                                     */
const psfAttr = (keys, vals) => keys.reduce((t, k, i) => t + CNS5.attributeBonus(vals[i]), 0);
ok("Stephen short sword attribute bonus", psfAttr(["str", "agl"], [13, 12]), 1);
ok("Sue short sword attribute bonus", psfAttr(["str", "agl"], [11, 16]), 4);

/* A doubled attribute is the same key twice: Faith is SPR x 2. */
ok("Faith SPR 16 x 2", psfAttr(["spr", "spr"], [16, 16]), 8);

/* -- Skill categories (p119-120) ------------------------------------------- */

/* There are three and only three. Core and Background are not categories: the
   rules promote both as Secondary Skills, and a vocational skill that is also a
   background skill "receives no additional bonuses for being part" of both. */
ok("the categories the rules recognise", Object.keys(CNS5.skillCategories).sort(),
   ["primary", "secondary", "tertiary"]);
ok("Primary is the vocational bonus", CNS5.skillCategories.primary.psf, 10);
ok("Secondary is the neutral case", CNS5.skillCategories.secondary.psf, 0);
ok("Tertiary is the hobby penalty", CNS5.skillCategories.tertiary.psf, -10);

/* Origin is provenance and must never carry a bonus of its own, or core and
   background skills would quietly stack a second adjustment. */
ok("origins are labels, not modifiers",
   Object.values(CNS5.skillOrigins).filter((v) => typeof v !== "string"), []);
ok("every origin is known",
   Object.keys(CNS5.skillOrigins).sort(), ["background", "chosen", "core", "vocational"]);

/* Old data used core and background as categories; both become Secondary with
   the origin preserved. */
const migrate = (source) => {
  if (source.category === "core" || source.category === "background") {
    source.origin ??= source.category;
    source.category = "secondary";
  }
  return source;
};
ok("a core skill migrates", migrate({ category: "core" }),
   { category: "secondary", origin: "core" });
ok("a background skill migrates", migrate({ category: "background" }),
   { category: "secondary", origin: "background" });
ok("a primary skill is left alone", migrate({ category: "primary" }), { category: "primary" });
ok("an explicit origin survives", migrate({ category: "core", origin: "vocational" }),
   { category: "secondary", origin: "vocational" });

/* The gentle birth bonus (p119). */
ok("the skills it applies to", CNS5.gentleSkills.map((g) => g.name), ["Courtly Love", "Leadership"]);
ok("Courtly Love is excepted in the Early Feudal period",
   CNS5.gentleSkills[0].exceptPeriods, ["ef"]);
ok("Leadership is not excepted anywhere", CNS5.gentleSkills[1].exceptPeriods, []);
ok("both are worth +10%", CNS5.gentleSkills.map((g) => g.bonus), [10, 10]);

/* Every gentle skill has to name a skill that exists, or the bonus never lands
   and nothing anywhere says so. */
const known = new Set(skillList.map((s) => s.name));
ok("and both name a real skill", CNS5.gentleSkills.filter((g) => !known.has(g.name)).map((g) => g.name), []);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
