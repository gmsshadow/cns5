/**
 * Non-player characters: quality tiers, and the bestiary Boar.
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

/* -- Quality and campaign tier (p513) -------------------------------------- */

ok("an inferior NPC", [CNS5.npcQuality.inferior.psf, CNS5.npcQuality.inferior.ar], [-2, -2]);
ok("an average one is unmodified", [CNS5.npcQuality.average.psf, CNS5.npcQuality.average.ar], [0, 0]);
ok("a superior one", [CNS5.npcQuality.superior.psf, CNS5.npcQuality.superior.ar], [2, 2]);
ok("an exceptional one", [CNS5.npcQuality.exceptional.psf, CNS5.npcQuality.exceptional.ar], [4, 4]);

/* The book's worked example: "an Exceptional Heroic NPC would receive +8% to
   PSF and +6% to all AR rolls". Exceptional alone is +4 and +4, so the Heroic
   figures follow by subtraction rather than by guesswork. */
const combined = (quality, tier) => [
  CNS5.npcQuality[quality].psf + CNS5.npcTier[tier].psf,
  CNS5.npcQuality[quality].ar + CNS5.npcTier[tier].ar
];
ok("an Exceptional Heroic NPC", combined("exceptional", "heroic"), [8, 6]);
ok("an average Historical one is unmodified", combined("average", "historical"), [0, 0]);
ok("an inferior Heroic one", combined("inferior", "heroic"), [2, 0]);

/* -- The Boar (p544) ------------------------------------------------------- */

const bestiary = JSON.parse(await readFile(path.join(ROOT, "data", "bestiary.json"), "utf8"));
const boar = bestiary.creatures.find((c) => c.name === "Boar");

ok("the Boar is in the bestiary", Boolean(boar), true);
ok("its weight", boar.weight, 450);
ok("its Body", boar.body, 57);
ok("its Fatigue", boar.fatigue, 34);
ok("its Base Action Points", boar.bap, 12);
ok("its Magick Resistance", boar.magickResistance, 10);

/* A boar is more dangerous than a bear and less than a great boar, and its
   Body exceeds its Fatigue — a sanity check on the transcription, since
   swapping those two columns is the obvious way to get this wrong. */
ok("Body exceeds Fatigue", boar.body > boar.fatigue, true);

ok("it has two attacks", boar.attacks.map((a) => a.name), ["Tusk", "Hooves"]);
ok("the tusk", [boar.attacks[0].psf, boar.attacks[0].damage, boar.attacks[0].damageType], [36, 16, "pierce"]);
ok("the hooves", [boar.attacks[1].psf, boar.attacks[1].damage, boar.attacks[1].damageType], [6, 4, "crush"]);

/* Natural attacks use the natural weight columns of the Attacker's Bonus
   table, so those weight classes have to be ones the table knows. */
ok(
  "every attack has a known weight class",
  boar.attacks.filter((a) => !CNS5.weaponWeights[a.weightClass]).map((a) => a.name),
  []
);

ok("its three listed skills", boar.skills.map((s) => s.name), ["Dodge", "Stamina", "Willpower"]);
ok("Dodge is flatly zero", boar.skills[0].psf, 0);
ok("Stamina", boar.skills[1].psf, 36);
ok("Willpower", boar.skills[2].psf, 24);

ok(
  "its hide absorbs on all five types",
  ["slash", "crush", "pierce", "missile", "energy"].map((k) => boar.armour[k]),
  [8, 12, 6, 8, 5]
);

/* A natural attack rolls at Difficulty Factor 3 with its stated PSF as the
   whole of its Personal Skill Factor: the tusk works out at 40 + 36 = 76,
   inside the band, so it rolls at 76%. */
const band = CNS5.difficultyFactors[3];
ok("the tusk's success chance", Math.min(band.skilled + 36, band.max), 76);
ok("the hooves' success chance", Math.min(band.skilled + 6, band.max), 46);

console.log(fails ? `\n${fails} FAILURES` : "\nAll checks passed.");
process.exit(fails ? 1 : 0);
