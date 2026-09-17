/**
 * Static rules data for Chivalry & Sorcery 5th Edition.
 *
 * Everything in this file is a lookup table or a pure function over one. Keeping
 * them here rather than inline in the data models means the character creation
 * wizard (a later phase) can reuse the same tables without importing sheet code.
 */

export const CNS5 = {};

/* -------------------------------------------- */
/*  Attributes                                  */
/* -------------------------------------------- */

/**
 * The nine rolled attributes, keyed by group as they appear on the printed sheet.
 * AGL, FER and CHA are omitted here because they are averages of other attributes.
 */
CNS5.primaryAttributes = {
  physical: ["str", "con", "dex"],
  mental: ["int", "wis", "dis"],
  social: ["app", "bv", "spr"]
};

/**
 * Derived attributes and the three attributes each averages.
 * Worksheet steps 11: AGL = (STR+CON+DEX)/3, FER = (STR+WIS+DIS)/3, CHA = (WIS+APP+BV)/3.
 */
CNS5.derivedAttributes = {
  agl: { group: "physical", from: ["str", "con", "dex"] },
  fer: { group: "mental", from: ["str", "wis", "dis"] },
  cha: { group: "social", from: ["wis", "app", "bv"] }
};

/** Display order per column on the Core & Combat tab. */
CNS5.attributeGroups = {
  physical: ["str", "con", "dex", "agl"],
  mental: ["int", "wis", "dis", "fer"],
  social: ["app", "bv", "spr", "cha"]
};

/** Maximum attribute level by character type (p103). Minimum is 2 for humans. */
CNS5.attributeMaximum = {
  historical: 20,
  heroic: 22,
  mythic: 25
};

/**
 * Table - Attribute Bonus or Penalty (p33). Returns the PSF% modifier.
 * Below 3 is -10%; above 22 gains a further +1% per point.
 * @param {number} value
 * @returns {number}
 */
CNS5.attributeBonus = function (value) {
  const v = Math.round(Number(value) || 0);
  if (v < 3) return -10;
  if (v > 22) return 12 + (v - 22);
  return [
    /* 3 */ -9, -7, -5, -4, -3, -2, -1, 0, 0, 0,
    /* 13 */ 1, 2, 3, 4, 5, 6, 8, 10, 11, 12
  ][v - 3];
};

/**
 * Table - Attribute Rolls & Success Chance (p103). Returns the AR% for a level.
 * @param {number} value
 * @returns {number}
 */
CNS5.attributeRoll = function (value) {
  const v = Math.round(Number(value) || 0);
  if (v <= 2) return 20;
  if (v >= 25) return 99;
  return {
    3: 25, 4: 30, 5: 35, 6: 40, 7: 45, 8: 50, 9: 54, 10: 58, 11: 62, 12: 66,
    13: 70, 14: 73, 15: 76, 16: 79, 17: 82, 18: 85, 19: 88, 20: 90, 21: 92,
    22: 94, 23: 96, 24: 98
  }[v];
};

/* -------------------------------------------- */
/*  Skillskape                                  */
/* -------------------------------------------- */

/**
 * Table - Difficulty Factors (p33). Not consumed by the Core & Combat tab, but
 * the skill item in the next phase reads straight from here.
 */
CNS5.difficultyFactors = {
  1: { label: "Very simple", unskilled: 50, skilled: 60, min: 8, max: 99, exp: 300 },
  2: { label: "Simple", unskilled: 40, skilled: 50, min: 6, max: 98, exp: 400 },
  3: { label: "Average", unskilled: 30, skilled: 40, min: 5, max: 97, exp: 500 },
  4: { label: "Challenging", unskilled: 20, skilled: 30, min: 4, max: 95, exp: 600 },
  5: { label: "Demanding", unskilled: 10, skilled: 20, min: 3, max: 92, exp: 700 },
  6: { label: "Difficult", unskilled: 5, skilled: 10, min: 2, max: 90, exp: 800 },
  7: { label: "Very Difficult", unskilled: 3, skilled: 7, min: 1, max: 85, exp: 1000 },
  8: { label: "Extremely Difficult", unskilled: 2, skilled: 3, min: 1, max: 75, exp: 1200 },
  9: { label: "Nearly Impossible", unskilled: 1, skilled: 2, min: 1, max: 65, exp: 1500 },
  10: { label: "Impossible", unskilled: 0, skilled: 1, min: 1, max: 50, exp: 2000 }
};

/**
 * Skill categories and their PSF% adjustment (p32, p119-120).
 *
 * There are only three. A skill is Primary if the character's vocation lists it
 * as such, Tertiary if it is a hobby, and Secondary otherwise — which is what
 * both core and background skills are, "unless they are listed as Primary (or
 * Vocational) Skills for the character's chosen vocation" (p119). Where a
 * vocational skill is also a background skill it gains nothing extra for being
 * both, so the categories do not stack and there is no reason to keep more of
 * them than the rules recognise.
 *
 * Mastery and Sunsign are not categories: each adds its own separate +10% and
 * both can apply to a skill of any category, so they are flags on the item.
 *
 * `limit` is the number of skills a character may take in that category among
 * their starting choices. It is advisory here; the creation wizard will enforce
 * it.
 */
CNS5.skillCategories = {
  primary: { psf: 10, label: "CNS5.SkillCategory.primary", limit: 10 },
  secondary: { psf: 0, label: "CNS5.SkillCategory.secondary", limit: 4 },
  tertiary: { psf: -10, label: "CNS5.SkillCategory.tertiary", limit: null }
};

/** Display order for the skills tab. */
CNS5.skillCategoryOrder = ["primary", "secondary", "tertiary"];

/**
 * Where a skill came from.
 *
 * This is provenance, not mechanics: it carries no PSF adjustment of its own
 * and exists so the sheet can show at a glance which skills a character was
 * born to, which came with the vocation, and which were chosen. The rules use
 * these words freely but promote all of them as one of the three categories
 * above.
 */
CNS5.skillOrigins = {
  chosen: "CNS5.SkillOrigin.chosen",
  core: "CNS5.SkillOrigin.core",
  background: "CNS5.SkillOrigin.background",
  vocational: "CNS5.SkillOrigin.vocational"
};

/**
 * Skills a gentle character gains +10% PSF in (p119). Courtly Love is excluded
 * in the Early Feudal period, when it had not yet taken hold.
 */
CNS5.gentleSkills = [
  { name: "Courtly Love", bonus: 10, exceptPeriods: ["ef"] },
  { name: "Leadership", bonus: 10, exceptPeriods: [] }
];

/**
 * The nine skills every character possesses (printed character sheet, p597).
 *
 * Difficulty Factors and attribute pairs are taken from the skills list on
 * p147-148, not from the character sheet itself: the sheet prints an experience
 * cost of 900 for the two Alertness skills, where the Difficulty Factor table
 * gives 1,000 for DF 7. The DF table is treated as authoritative throughout.
 *
 * This seed exists to make the skill engine testable before the generated
 * compendium lands in phase 3, which will supersede it.
 */
CNS5.coreSkills = [
  { name: "Language (Own) — Spoken", df: 1, attributes: ["int", "bv"] },
  { name: "Alertness: Sight", df: 7, attributes: [] },
  { name: "Alertness: Sound", df: 7, attributes: [] },
  { name: "Local Geography & History", df: 1, attributes: ["int", "int"] },
  { name: "Dodge", df: 3, attributes: ["agl", "wis"] },
  { name: "Brawling", df: 3, attributes: ["str", "agl"] },
  { name: "Stamina", df: 3, attributes: ["str", "con"] },
  { name: "Willpower", df: 3, attributes: ["dis", "wis"] },
  { name: "Faith", df: 5, attributes: ["spr", "spr"] }
];

/* -------------------------------------------- */
/*  Body, Fatigue and Encumbrance               */
/* -------------------------------------------- */

/**
 * Table - Weight Factor (p106). Upper bound of each band, in pounds, mapped to
 * the primary Body contribution.
 */
CNS5.weightFactorBands = [
  [44, 10], [53, 11], [64, 12], [75, 13], [87, 14], [100, 15], [113, 16],
  [128, 17], [144, 18], [160, 19], [177, 20], [196, 21], [215, 22], [235, 23],
  [256, 24], [278, 25], [300, 26], [324, 27], [348, 28], [373, 29], [400, 30],
  [427, 31], [455, 32], [484, 33]
];

/**
 * Primary Body from body weight in pounds.
 * Weights beyond the printed table extrapolate at roughly +1 per 7% of weight.
 * @param {number} weight
 * @returns {number}
 */
CNS5.weightFactor = function (weight) {
  const w = Number(weight) || 0;
  for (const [upper, body] of CNS5.weightFactorBands) {
    if (w <= upper) return body;
  }
  return 33 + Math.floor(Math.log(w / 484) / Math.log(1.07));
};

/**
 * Table - Strength/Body Ratio (p111). LCAP = 5 lbs + N% of body weight.
 * @param {number} str
 * @returns {number} the percentage of body weight
 */
CNS5.liftingPercent = function (str) {
  const s = Math.round(Number(str) || 0);
  if (s <= 2) return 25;
  if (s >= 31) return 500;
  return {
    3: 30, 4: 35, 5: 35, 6: 40, 7: 50, 8: 60, 9: 70, 10: 80, 11: 90, 12: 100,
    13: 105, 14: 110, 15: 120, 16: 130, 17: 140, 18: 150, 19: 160, 20: 170,
    21: 180, 22: 190, 23: 200, 24: 210, 25: 225, 26: 250, 27: 300, 28: 350,
    29: 400, 30: 450
  }[s];
};

/**
 * Table - Body Recovery Rates (p108). Percentage of maximum Body per day.
 * @param {number} con
 */
CNS5.bodyRecovery = function (con) {
  const c = Math.round(Number(con) || 0);
  const table = {
    2: [1, 0, 0, 30], 3: [2, 1, 0, 40], 4: [2, 1, 1, 50], 5: [2, 1, 1, 55],
    6: [3, 1, 1, 60], 7: [4, 2, 1, 65], 8: [5, 3, 1, 70], 9: [5, 3, 1, 75],
    10: [6, 3, 1, 80], 11: [6, 3, 1, 82], 12: [6, 3, 1, 84], 13: [7, 3, 1, 86],
    14: [7, 4, 2, 88], 15: [7, 4, 2, 90], 16: [8, 4, 2, 92], 17: [8, 5, 3, 94],
    18: [8, 5, 3, 96], 19: [8, 5, 3, 97], 20: [9, 6, 3, 98]
  };
  const row = c <= 2 ? table[2] : c >= 21 ? [10, 6, 4, 99] : table[c];
  return { rest: row[0], light: row[1], active: row[2], resistDisease: row[3] };
};

/**
 * Table - Fatigue Recovery Rates (p110). FP regained by sleeping an hour, and
 * by the first ten minutes of rest.
 * @param {number} con
 */
CNS5.fatigueRecovery = function (con) {
  const c = Math.round(Number(con) || 0);
  if (c <= 6) return { sleep: 5, rest: 2 };
  if (c <= 10) return { sleep: 6, rest: 3 };
  if (c <= 13) return { sleep: 7, rest: 4 };
  if (c <= 15) return { sleep: 8, rest: 5 };
  if (c <= 17) return { sleep: 9, rest: 6 };
  if (c === 18) return { sleep: 10, rest: 7 };
  if (c === 19) return { sleep: 12, rest: 8 };
  if (c === 20) return { sleep: 13, rest: 9 };
  return { sleep: 15, rest: 10 };
};

/* -------------------------------------------- */
/*  Crit Die                                    */
/* -------------------------------------------- */

/** Table - Critical Outcomes - General (p37). */
CNS5.criticalOutcomes = {
  success: [
    { max: 1, key: "mediocre" },
    { max: 5, key: "middling" },
    { max: 9, key: "competent" },
    { max: Infinity, key: "critical" }
  ],
  failure: [
    { max: 1, key: "heartbreaking" },
    { max: 5, key: "disappointing" },
    { max: 9, key: "botched" },
    { max: Infinity, key: "abysmal" }
  ]
};

/**
 * Resolve a Crit Die total against the general outcome table.
 * A result of 10 or more is always critical, in either direction.
 * @param {number} total  the Crit Die result after modifiers
 * @param {boolean} success
 * @returns {string} outcome key
 */
CNS5.critOutcome = function (total, success) {
  const band = success ? CNS5.criticalOutcomes.success : CNS5.criticalOutcomes.failure;
  const clamped = Math.max(1, total);
  return band.find((b) => clamped <= b.max).key;
};

/* -------------------------------------------- */
/*  Character creation vocabulary                */
/* -------------------------------------------- */

CNS5.characterTypes = {
  historical: "CNS5.CharacterType.historical",
  heroic: "CNS5.CharacterType.heroic",
  mythic: "CNS5.CharacterType.mythic"
};

CNS5.periods = {
  ef: "CNS5.Period.ef",
  hc: "CNS5.Period.hc",
  lf: "CNS5.Period.lf",
  wf: "CNS5.Period.wf"
};

CNS5.birthOmens = {
  well: "CNS5.Omens.well",
  neutral: "CNS5.Omens.neutral",
  poor: "CNS5.Omens.poor"
};

/** Magick Resistance is 10% for Neutral omens, 0% otherwise (worksheet, p288). */
CNS5.magickResistance = {
  well: 0,
  neutral: 10,
  poor: 0
};

/* -------------------------------------------- */
/*  Combat                                      */
/* -------------------------------------------- */

/**
 * Weapon weight classes (p282). Weight sets the attack rate and the damage
 * bonus; the damage type sets which armour absorption value applies.
 */
CNS5.weaponWeights = {
  naturalLight: { label: "CNS5.WeaponWeight.naturalLight", column: 0, light: true, natural: true },
  // The Attacker's Bonus table pairs a natural medium weapon with a light one
  // and a natural heavy with a medium, which is why these share their columns.
  naturalMedium: { label: "CNS5.WeaponWeight.naturalMedium", column: 1, light: false, natural: true },
  naturalHeavy: { label: "CNS5.WeaponWeight.naturalHeavy", column: 2, light: false, natural: true },
  light: { label: "CNS5.WeaponWeight.light", column: 1, light: true },
  medium: { label: "CNS5.WeaponWeight.medium", column: 2, light: false },
  heavy: { label: "CNS5.WeaponWeight.heavy", column: 3, light: false },
  twoHanded: { label: "CNS5.WeaponWeight.twoHanded", column: 4, light: false }
};

/** Damage types, matching the armour absorption columns. */
CNS5.damageTypes = {
  slash: "CNS5.DamageType.slash",
  crush: "CNS5.DamageType.crush",
  pierce: "CNS5.DamageType.pierce",
  missile: "CNS5.DamageType.missile",
  energy: "CNS5.DamageType.energy"
};

/**
 * Table - Attacker's Bonus (p282). Rows are skill level bands, columns are the
 * five weapon weight classes in the order given by `weaponWeights`.
 *
 * The table starts at Level 1. A character with only basic knowledge (Level 0)
 * gets no attacker's bonus.
 */
CNS5.attackerBonusTable = [
  { max: 0, bonus: [0, 0, 0, 0, 0] },
  { max: 1, bonus: [0, 1, 1, 2, 2] },
  { max: 2, bonus: [0, 1, 2, 2, 2] },
  { max: 4, bonus: [0, 1, 2, 3, 3] },
  { max: 5, bonus: [0, 1, 2, 3, 3] },
  { max: 6, bonus: [1, 1, 3, 3, 4] },
  { max: 7, bonus: [1, 2, 3, 4, 4] },
  { max: 9, bonus: [1, 2, 3, 4, 5] },
  { max: 10, bonus: [1, 2, 3, 4, 5] },
  { max: 11, bonus: [1, 2, 4, 5, 6] },
  { max: 12, bonus: [2, 3, 4, 5, 6] },
  { max: 14, bonus: [2, 3, 4, 5, 6] },
  { max: 15, bonus: [2, 3, 5, 6, 7] },
  { max: 16, bonus: [2, 3, 5, 6, 7] },
  { max: 17, bonus: [2, 4, 6, 7, 7] },
  { max: 19, bonus: [2, 4, 6, 7, 8] },
  { max: Infinity, bonus: [3, 5, 7, 8, 8] }
];

/**
 * The Attacker's Bonus for a skill level and weapon weight.
 * @param {number} level
 * @param {string} weight  a key of CNS5.weaponWeights
 * @returns {number}
 */
CNS5.attackerBonus = function (level, weight) {
  const column = CNS5.weaponWeights[weight]?.column ?? 2;
  const row = CNS5.attackerBonusTable.find((r) => (Number(level) || 0) <= r.max);
  return row.bonus[column];
};

/** Armour weight classes (p260). Heavy and Battle require their own skills. */
CNS5.armourWeights = {
  none: { label: "CNS5.ArmourWeight.none", thiefPenalty: 0 },
  light: { label: "CNS5.ArmourWeight.light", thiefPenalty: 0 },
  heavy: { label: "CNS5.ArmourWeight.heavy", thiefPenalty: -10 },
  battle: { label: "CNS5.ArmourWeight.battle", thiefPenalty: -20 }
};

/** Where a piece of armour sits. Shields absorb separately from worn armour. */
CNS5.armourLocations = {
  body: "CNS5.ArmourLocation.body",
  head: "CNS5.ArmourLocation.head",
  limbs: "CNS5.ArmourLocation.limbs",
  shield: "CNS5.ArmourLocation.shield"
};

/**
 * Dodge is penalised by armour weight (p280).
 */
CNS5.dodgePenalty = { none: 0, light: 0, heavy: -10, battle: -20 };

/* -------------------------------------------- */
/*  Encumbrance                                 */
/* -------------------------------------------- */

/**
 * Exceeding Carrying Capacity costs 1 Fatigue Point per hour for every 20% of
 * CCAP the load is over (p111). The printed sheet stops at +100%; the rule is
 * open-ended, so the derivation computes it rather than reading a table.
 */
CNS5.encumbranceStep = 0.2;

/* -------------------------------------------- */
/*  Currency                                    */
/* -------------------------------------------- */

/** Pounds, shillings, pence and farthings. 1£ = 20s = 240d, 1d = 4f. */
CNS5.currency = {
  pounds: { label: "CNS5.Currency.pounds", abbr: "£", inFarthings: 960 },
  shillings: { label: "CNS5.Currency.shillings", abbr: "s", inFarthings: 48 },
  pence: { label: "CNS5.Currency.pence", abbr: "d", inFarthings: 4 },
  farthings: { label: "CNS5.Currency.farthings", abbr: "f", inFarthings: 1 }
};

/* -------------------------------------------- */
/*  Magick                                      */
/* -------------------------------------------- */

/**
 * Table - Magick Levels (p289). ML 1 up to PMF 51, then one level per 7 points.
 * @param {number} pmf
 * @returns {number}
 */
CNS5.magickLevel = function (pmf) {
  const p = Number(pmf) || 0;
  if (p <= 51) return 1;
  return 1 + Math.ceil((p - 51) / 7);
};

/**
 * The aspect bonus to Personal Magick Factor (worksheet, p288).
 * A mage gains +10 when Well or Poorly Aspected; a priest-mage gains +10 when
 * Neutral. The two are mirror images, which is the point: the same birth omens
 * help one tradition and not the other.
 */
CNS5.magickAspectBonus = function (omens, tradition) {
  if (tradition === "priestMage") return omens === "neutral" ? 10 : 0;
  return omens === "neutral" ? 0 : 10;
};

CNS5.magickTraditions = {
  none: "CNS5.Tradition.none",
  mage: "CNS5.Tradition.mage",
  priestMage: "CNS5.Tradition.priestMage",
  cleric: "CNS5.Tradition.cleric"
};

/** Spell range bands and their targeting penalties (character sheet, p599). */
CNS5.spellRanges = {
  short: { label: "CNS5.SpellRange.short", modifier: 0 },
  long: { label: "CNS5.SpellRange.long", modifier: -10 },
  max: { label: "CNS5.SpellRange.max", modifier: -30 }
};

/* -------------------------------------------- */
/*  Armour weight                               */
/* -------------------------------------------- */

/**
 * Printed armour weights assume a wearer of 150 to 174 lbs (p261). A larger or
 * smaller frame needs more or less metal, so each piece carries a weight
 * modifier applied in steps from that band.
 */
CNS5.armourReferenceWeight = { low: 150, high: 174, step: 25 };

/**
 * The multiplier applied to a piece's weight modifier for a given wearer.
 *
 * Above the band the rules are explicit: add the modifier once for every 25 lbs
 * over 174, rounded up. Below it they are not. The book names two cases — 100
 * to 124 lbs subtracts the modifier once, under 100 lbs subtracts it twice —
 * and says nothing about 125 to 149. That gap is filled with a single
 * subtraction, which is what both the neighbouring band and the 25 lb ladder
 * above the band imply.
 *
 * @param {number} bodyWeight  the wearer's weight in pounds
 * @returns {number} signed multiplier
 */
CNS5.armourWeightMultiplier = function (bodyWeight) {
  const w = Number(bodyWeight) || 0;
  const { low, high, step } = CNS5.armourReferenceWeight;

  if (w > high) return Math.ceil((w - high) / step);
  if (w >= low) return 0;
  if (w >= 100) return -1;
  return -2;
};

/**
 * A piece's weight as worn by a particular character.
 * @param {number} baseWeight
 * @param {number} modifier
 * @param {number} bodyWeight
 * @returns {number}
 */
CNS5.armourWeightFor = function (baseWeight, modifier, bodyWeight) {
  const adjusted = baseWeight + modifier * CNS5.armourWeightMultiplier(bodyWeight);
  return Math.max(0, Math.round(adjusted * 100) / 100);
};

/* -------------------------------------------- */
/*  Action Points                               */
/* -------------------------------------------- */

/**
 * Table - Combat Actions (p271).
 *
 * Action Point costs are keyed off the character's PSF% in the relevant skill,
 * not off the weapon: knowing a weapon well is what makes you quick with it.
 *
 * The band boundaries are as printed. Note the gap: the fourth band ends at 70%
 * and the fifth begins at 75%, leaving 71-74% unstated. It is read here as the
 * top band starting at 71%, which is the only reading that leaves no hole.
 */
CNS5.actionPointBands = [
  { max: 25, label: "CNS5.ApBand.1" },
  { max: 45, label: "CNS5.ApBand.2" },
  { max: 60, label: "CNS5.ApBand.3" },
  { max: 70, label: "CNS5.ApBand.4" },
  { max: Infinity, label: "CNS5.ApBand.5" }
];

/**
 * Costs run in band order. Transcribed from the printed table rather than
 * parsed: several rows wrap across three lines with their figures on the middle
 * one, and the text layer interleaves them with their neighbours.
 */
CNS5.combatActions = {
  mountWarhorse: { costs: [4, 4, 3, 3, 2], skill: "Riding Horse" },
  attackNaturalLight: { costs: [5, 5, 4, 4, 3], skill: null },
  attackNaturalMedium: { costs: [7, 6, 6, 5, 4], skill: null },
  attackNaturalHeavy: { costs: [9, 8, 7, 6, 5], skill: null },
  attackLight: { costs: [7, 6, 6, 5, 4], skill: null },
  attackMedium: { costs: [9, 8, 7, 6, 5], skill: null },
  attackHeavy: { costs: [11, 10, 9, 8, 7], skill: null },
  attackPolearm: { costs: [12, 11, 9, 8, 7], skill: null },
  dropWeapon: { costs: [0, 0, 0, 0, 0], skill: null },
  drawWeapon: { costs: [1, 1, 1, 1, 1], skill: null },
  unslingWeapon: { costs: [3, 3, 2, 2, 2], skill: null },
  sheatheWeapon: { costs: [4, 4, 3, 3, 2], skill: null },
  fireSling: { costs: [10, 9, 8, 7, 6], skill: "Slings" },
  fireBow: { costs: [9, 8, 7, 6, 5], skill: "Archery" },
  fireBowFast: { costs: [6, 5, 5, 4, 4], skill: "Archery" },
  loadLightCrossbow: { costs: [15, 14, 12, 11, 9], skill: "Archery" },
  // The fourth figure is printed as 12, which is lower than the band above it
  // and out of step with every other row. Preserved as printed.
  loadMediumCrossbow: { costs: [30, 27, 24, 12, 18], skill: "Archery" },
  loadHeavyCrossbow: { costs: [60, 54, 48, 42, 36], skill: "Archery" },
  fireCrossbow: { costs: [1, 1, 1, 1, 1], skill: "Archery" },
  throwWeapon: { costs: [7, 6, 6, 5, 4], skill: null },
  setPolearm: { costs: [3, 3, 2, 2, 2], skill: "Pole Arms" },
  setLance: { costs: [3, 3, 2, 2, 2], skill: "Cavalry Lance" },
  dodge: { costs: [1, 1, 1, 1, 1], skill: "Dodge" },
  parryLight: { costs: [1, 1, 1, 1, 1], skill: null },
  parryMedium: { costs: [2, 2, 2, 1, 1], skill: null },
  parryHeavy: { costs: [3, 3, 2, 2, 2], skill: null },
  parryPolearm: { costs: [4, 4, 3, 3, 2], skill: null },
  blockBuckler: { costs: [1, 1, 1, 1, 1], skill: "Shield Play: Light" },
  bashBuckler: { costs: [2, 2, 2, 1, 1], skill: "Shield Play: Light" },
  blockHeater: { costs: [2, 2, 2, 1, 1], skill: "Shield Play: Heavy" },
  bashHeater: { costs: [4, 4, 3, 3, 2], skill: "Shield Play: Heavy" },
  blockLargeShield: { costs: [3, 3, 2, 2, 2], skill: "Shield Play: Heavy" },
  bashLargeShield: { costs: [7, 6, 6, 5, 4], skill: "Shield Play: Heavy" },
  castCantrip: { costs: [9, 8, 7, 6, 5], skill: null },
  castHex: { costs: [19, 17, 15, 13, 11], skill: null },
  castSorcery: { costs: [29, 26, 23, 20, 17], skill: null },
  wordOfGuard: { costs: [3, 3, 2, 2, 2], skill: null }
};

/**
 * The Action Point cost of an action for a character with a given PSF%.
 * @param {string} action  a key of CNS5.combatActions
 * @param {number} psf
 * @returns {number|null}
 */
CNS5.actionPointCost = function (action, psf) {
  const entry = CNS5.combatActions[action];
  if (!entry) return null;
  const index = CNS5.actionPointBands.findIndex((b) => (Number(psf) || 0) <= b.max);
  return entry.costs[index];
};

/**
 * The attack action a weapon uses, from its role and weight.
 *
 * Polearms cost a point more than other heavy arms, and the tables identify
 * them by their group rather than by a weight class of their own.
 *
 * @param {object} weapon  a weapon's system data
 * @returns {string}
 */
CNS5.weaponAttackAction = function (weapon) {
  if (weapon.role === "launcher") {
    if (/sling/i.test(weapon.group ?? "")) return "fireSling";
    if (/crossbow/i.test(weapon.group ?? "") || /crossbow/i.test(weapon.name ?? "")) {
      return "fireCrossbow";
    }
    return "fireBow";
  }
  if (weapon.missile && weapon.role === "melee") return "throwWeapon";
  if (/polearm/i.test(weapon.group ?? "")) return "attackPolearm";

  return {
    naturalLight: "attackNaturalLight",
    naturalMedium: "attackNaturalMedium",
    naturalHeavy: "attackNaturalHeavy",
    light: "attackLight",
    medium: "attackMedium",
    heavy: "attackHeavy",
    twoHanded: "attackHeavy"
  }[weapon.weightClass] ?? "attackMedium";
};

/* -------------------------------------------- */
/*  Aimed shots                                 */
/* -------------------------------------------- */

/** Table - Aimed Shot Modifiers (p272). Optional rule. */
CNS5.aimedShotModifiers = {
  none: { label: "CNS5.TargetArea.none", modifier: 0 },
  chest: { label: "CNS5.TargetArea.chest", modifier: 0 },
  abdomen: { label: "CNS5.TargetArea.abdomen", modifier: -5 },
  arm: { label: "CNS5.TargetArea.arm", modifier: -10 },
  upperLeg: { label: "CNS5.TargetArea.upperLeg", modifier: -15 },
  hand: { label: "CNS5.TargetArea.hand", modifier: -25 },
  lowerLeg: { label: "CNS5.TargetArea.lowerLeg", modifier: -25 },
  groin: { label: "CNS5.TargetArea.groin", modifier: -30 },
  head: { label: "CNS5.TargetArea.head", modifier: -40 },
  foot: { label: "CNS5.TargetArea.foot", modifier: -40 },
  neck: { label: "CNS5.TargetArea.neck", modifier: -50 },
  eyes: { label: "CNS5.TargetArea.eyes", modifier: -60 }
};

/* -------------------------------------------- */
/*  Character creation                          */
/* -------------------------------------------- */

/**
 * The three ways to generate a character (p52, p103).
 *
 * Random and Lion Heart both roll; they differ in how forgiving the dice are.
 * Design spends a budget of PC Points instead, which is why only that method
 * carries one.
 */
CNS5.creationMethods = {
  random: { label: "CNS5.Creation.method.random", rolls: true, budget: false },
  lionHeart: { label: "CNS5.Creation.method.lionHeart", rolls: true, budget: false },
  design: { label: "CNS5.Creation.method.design", rolls: false, budget: true }
};

/** PC Point budgets for the design method, by character type (p52). */
CNS5.pcBudget = { historical: 125, heroic: 150, mythic: 180 };

/** Attribute bonuses added to every roll for the tougher character types. */
CNS5.typeRollBonus = { historical: 0, heroic: 2, mythic: 5 };

/**
 * The PC Point cost of buying an attribute to a given level (p103).
 * One point per level up to and including 15, two per level after that.
 *
 * The worksheet's own figures follow from this: nine attributes at 11 costs 99
 * points, at 13 costs 117, and at 16 costs 153.
 *
 * @param {number} level
 * @returns {number}
 */
CNS5.attributeCost = function (level) {
  const v = Math.max(0, Math.round(Number(level) || 0));
  return Math.min(v, 15) + Math.max(0, v - 15) * 2;
};

/** Humans must buy at least two levels in every attribute (p103). */
CNS5.attributeMinimum = 2;

/**
 * Innate ability modifiers for the three derived attributes (p103). The roll
 * gives a magnitude; its direction is the player's to choose.
 */
CNS5.innateModifiers = [
  { roll: 2, magnitude: 0, cost: 0 },
  { roll: 4, magnitude: 1, cost: 1 },
  { roll: 6, magnitude: 2, cost: 3 },
  { roll: 8, magnitude: 3, cost: 5 },
  { roll: 10, magnitude: 4, cost: 8 }
];

/**
 * Table - Height & Build Determination (p104), for humans.
 *
 * Height is rolled on 2d10 plus a modifier and read directly as inches. Build
 * is rolled on 1d10 plus a modifier and then adjusted by Agility and
 * Constitution before it is looked up for weight.
 */
CNS5.heightAndBuild = {
  historical: {
    male: { heightMod: 57, defaultHeight: 68, buildMod: 1, defaultBuild: 6 },
    female: { heightMod: 54, defaultHeight: 65, buildMod: -1, defaultBuild: 4 }
  },
  heroic: {
    male: { heightMod: 62, defaultHeight: 73, buildMod: 2, defaultBuild: 7 },
    female: { heightMod: 59, defaultHeight: 70, buildMod: -1, defaultBuild: 4 }
  },
  mythic: {
    male: { heightMod: 67, defaultHeight: 78, buildMod: 3, defaultBuild: 6 },
    female: { heightMod: 64, defaultHeight: 75, buildMod: 1, defaultBuild: 6 }
  }
};

/** Buying a change to height or build costs 5 PC Points a step (p104-105). */
CNS5.heightPurchase = { cost: 5, inches: 6 };
CNS5.buildPurchase = { cost: 5, maxLevels: 3 };

/**
 * Build Factor adjustments from Agility and Constitution (p105).
 * @param {number} agl
 * @param {number} con
 * @returns {number}
 */
CNS5.buildAdjustment = function (agl, con) {
  let total = 0;
  if (agl >= 20) total -= 2;
  else if (agl >= 15) total -= 1;
  if (con >= 20) total += 2;
  else if (con >= 15) total += 1;
  return total;
};

/** Table - Weight Modifiers (p106). Percentage change by Build Factor. */
CNS5.weightModifiers = [
  { max: 0, percent: -30, label: "CNS5.Build.veryLight" },
  { max: 1, percent: -25, label: "CNS5.Build.veryLight" },
  { max: 2, percent: -20, label: "CNS5.Build.light" },
  { max: 3, percent: -15, label: "CNS5.Build.light" },
  { max: 4, percent: -5, label: "CNS5.Build.average" },
  { max: 5, percent: 0, label: "CNS5.Build.average" },
  { max: 6, percent: 5, label: "CNS5.Build.average" },
  { max: 7, percent: 10, label: "CNS5.Build.heavy" },
  { max: 8, percent: 15, label: "CNS5.Build.heavy" },
  { max: 9, percent: 20, label: "CNS5.Build.heavy" },
  { max: 10, percent: 25, label: "CNS5.Build.massive" },
  { max: 11, percent: 30, label: "CNS5.Build.massive" },
  { max: 12, percent: 35, label: "CNS5.Build.massive" },
  { max: Infinity, percent: 40, label: "CNS5.Build.massive" }
];

/**
 * Weight from height and build (p105-106). Ten pounds plus five for every inch
 * over forty, adjusted by the Build Factor's percentage, rounding up.
 *
 * The worked example: 69 inches gives 155 lbs, and a Build Factor of 6 raises
 * it by 5% to 163.
 *
 * @param {number} height  in inches
 * @param {number} build   the Build Factor
 * @returns {number}
 */
CNS5.weightFor = function (height, build) {
  const basic = 10 + Math.max(0, (Number(height) || 0) - 40) * 5;
  const band = CNS5.weightModifiers.find((b) => (Number(build) || 0) <= b.max);
  return Math.ceil(basic * (1 + band.percent / 100));
};

/**
 * Table - Basic Starting Age (p114). Rolled on 1d100.
 * `cost` is in PC Points: a younger character with less experience is cheaper,
 * and being older costs points.
 */
CNS5.startingAge = [
  { max: 5, human: 13, dwarf: 14, elf: 15, exp: 2500, cost: 10 },
  { max: 10, human: 14, dwarf: 16, elf: 17, exp: 3000, cost: 8 },
  { max: 20, human: 15, dwarf: 18, elf: 19, exp: 3500, cost: 6 },
  { max: 30, human: 16, dwarf: 20, elf: 25, exp: 4000, cost: 4 },
  { max: 40, human: 17, dwarf: 25, elf: 35, exp: 4500, cost: 2 },
  { max: 60, human: 18, dwarf: 30, elf: 50, exp: 5000, cost: 0 },
  { max: 65, human: 19, dwarf: 33, elf: 55, exp: 5500, cost: -2 },
  { max: 70, human: 20, dwarf: 36, elf: 60, exp: 6000, cost: -4 },
  { max: 75, human: 21, dwarf: 36, elf: 65, exp: 6500, cost: -6 },
  { max: 80, human: 22, dwarf: 39, elf: 70, exp: 7000, cost: -8 },
  { max: 85, human: 23, dwarf: 42, elf: 75, exp: 7500, cost: -10 },
  { max: 90, human: 24, dwarf: 45, elf: 80, exp: 8000, cost: -12 },
  { max: 100, human: 25, dwarf: 48, elf: 85, exp: 8500, cost: -14 }
];

/** The default starting age band: eighteen years old with 5,000 experience. */
CNS5.defaultAgeBand = CNS5.startingAge.find((b) => b.max === 60);

/* -------------------------------------------- */
/*  Weapons to combat skills                    */
/* -------------------------------------------- */

/**
 * The combat skill each weapon group is used with.
 *
 * The weapon tables and the skill list group things differently, so the
 * correspondence is written out rather than guessed at. Two groups need more
 * than a group rule: "Flails, Maces & Hammers" is one heading covering two
 * skills, and the Knives group holds both fighting knives and throwing ones.
 */
CNS5.weaponGroupSkills = {
  "Cavalry Lances": "Cavalry Lances",
  "Civilian Spears": "Spears",
  "War Spears": "Spears",
  Clubs: "Maces, Hammers & Clubs",
  "Fighting Staves": "Fighting Staves",
  "Flails, Maces & Hammers": "Maces, Hammers & Clubs",
  "Great Swords": "Great Swords",
  Knives: "Knife & Dagger Fighting",
  Polearms: "Polearms",
  Quiver: "Archery",
  "Short Swords": "Short Swords",
  "Slashing Swords": "Slashing Swords",
  Sling: "Slings",
  "War Axes": "Axes"
};

/** Weapons whose own name overrides their group's skill. */
CNS5.weaponNameSkills = [
  { pattern: /flail/i, skill: "Flails" },
  { pattern: /throwing knives|throwing daggers/i, skill: "Throwing Knives & Daggers" },
  { pattern: /javelin|pilum/i, skill: "Hurling Javelins" },
  { pattern: /bow$|bow\b/i, skill: "Archery" },
  { pattern: /crossbow/i, skill: "Archery" },
  { pattern: /arrow|bolt/i, skill: "Archery" }
];

/**
 * The combat skill a weapon is used with.
 *
 * Checked by name first, because a Cavalry Flail sits under a heading shared
 * with maces and a Throwing Knife under one shared with fighting knives. Then
 * by group, then by role, so a bow with no group at all still finds Archery.
 *
 * @param {object} weapon  a weapon's system data, plus its name
 * @returns {string}
 */
CNS5.weaponSkill = function (weapon) {
  const name = weapon.name ?? "";
  const match = CNS5.weaponNameSkills.find((entry) => entry.pattern.test(name));
  if (match) return match.skill;

  const byGroup = CNS5.weaponGroupSkills[weapon.group];
  if (byGroup) return byGroup;

  if (weapon.role === "launcher" || weapon.role === "ammunition") return "Archery";
  return "";
};

/* -------------------------------------------- */
/*  Spells to Modes of Magick                   */
/* -------------------------------------------- */

/**
 * The Mode of Magick skill each spell group is cast with.
 *
 * Most groups have a skill of nearly the same name; the differences are small
 * but exact matching matters, since the skill is found by name. Note the en
 * dashes in the four elemental skills, which the spell tables write as spaces.
 *
 * Seven groups are deliberately absent. Common Method Spells and Common
 * Elemental Control Spells are cast with whatever Mode the caster has, and
 * Healing, the two Eldritch groups, Portals to the Shadow World and Shadow
 * Monsters have no skill in the list that plainly corresponds. All of them fall
 * back to the caster's own Mode of Magick, which is the right answer for the
 * common spells and a serviceable guess for the rest.
 */
CNS5.spellGroupModes = {
  "Arcane Magick": "Arcane Magick",
  "Basic Magick Air": "Basic Magick – Air",
  "Basic Magick Earth": "Basic Magick – Earth",
  "Basic Magick Fire": "Basic Magick – Fire",
  "Basic Magick Water": "Basic Magick – Water",
  "Command Magick": "Command Magick",
  "Divination Spells": "Divination Magick",
  "Illusions Spells": "Illusion Magick",
  "Magickal Wards": "Wards Magick",
  "Plant Magick": "Plant Magick",
  Summoning: "Summoning Magick",
  "Transcendental Magick": "Transcendental Magick",
  "Transmutation Magick": "Transmutation Magick"
};

/**
 * The Mode of Magick skill a spell is cast with.
 *
 * @param {object} spell       a spell's system data
 * @param {string} [casterMode] the caster's own Mode of Magick, used where the
 *                              spell's group implies none
 * @returns {string}
 */
CNS5.spellMode = function (spell, casterMode = "") {
  return spell.mode || CNS5.spellGroupModes[spell.group] || casterMode || "";
};

/* -------------------------------------------- */
/*  Non-player characters                       */
/* -------------------------------------------- */

/**
 * How well suited an NPC is to what it does (p513).
 *
 * The modifiers apply to the PSF% of every skill and to every Attribute Roll.
 */
CNS5.npcQuality = {
  inferior: { label: "CNS5.Npc.quality.inferior", psf: -2, ar: -2 },
  average: { label: "CNS5.Npc.quality.average", psf: 0, ar: 0 },
  superior: { label: "CNS5.Npc.quality.superior", psf: 2, ar: 2 },
  exceptional: { label: "CNS5.Npc.quality.exceptional", psf: 4, ar: 4 }
};

/**
 * The campaign tier an NPC was built for, which stacks with quality.
 *
 * The rules state only that "an Exceptional Heroic NPC would receive +8% to
 * PSF and +6% to all AR rolls". Exceptional on its own is +4 and +4, so Heroic
 * contributes +4 and +2 — that is arithmetic from the book's own example, not a
 * guess. Mythic is never given a figure anywhere, so it borrows Heroic's rather
 * than inventing one; a GM who disagrees can set the modifiers by hand.
 */
CNS5.npcTier = {
  historical: { label: "CNS5.CharacterType.historical", psf: 0, ar: 0 },
  heroic: { label: "CNS5.CharacterType.heroic", psf: 4, ar: 2 },
  mythic: { label: "CNS5.CharacterType.mythic", psf: 4, ar: 2 }
};

/**
 * An NPC is either a person, built the way a character is, or a creature, whose
 * Body, Fatigue and Action Points the bestiary gives outright rather than
 * deriving from attributes it does not have.
 */
CNS5.npcKinds = {
  person: "CNS5.Npc.kind.person",
  creature: "CNS5.Npc.kind.creature"
};

/* -------------------------------------------- */
/*  Initiative and the Action Point pool        */
/* -------------------------------------------- */

/**
 * Table - Armour Modifiers (p268).
 *
 * Wearing nothing is an advantage rather than merely the absence of one: an
 * unarmoured character gains three Action Points a round. The Fatigue column
 * here is a flat cost by armour class, separate from the per-piece Fatigue the
 * armour tables on pp.261-263 give.
 */
CNS5.armourModifiers = {
  none: { ap: 3, fatigue: 0 },
  light: { ap: 0, fatigue: 0 },
  heavy: { ap: -3, fatigue: 1 },
  battle: { ap: -5, fatigue: 2 }
};

/** A character with no Fatigue Points left loses ten Action Points a round (p268). */
CNS5.exhaustedApPenalty = -10;

/**
 * The dice rolled for initiative. Each character rolls this and adds it to
 * their Base Action Points, modified for armour, to get the round's Action
 * Point pool (p268).
 */
CNS5.initiativeFormula = "1d10 + @initiative";

/** The die rolled afresh at the start of every Combat Round. */
CNS5.initiativeDie = "1d10";

/**
 * A maximum of ten Action Points may be spent on any one action within a single
 * Action Phase, and no more than ten on movement in a phase (p268). A character
 * taking two actions in a phase may therefore spend more than ten in total, so
 * this is what the prompt advises rather than what it enforces.
 */
CNS5.maxApPerAction = 10;

/**
 * What happens when a character declares an action costing more Action Points
 * than their pool holds.
 *
 * The rulebook does not settle this, so both readings offered by the game's
 * designers are provided:
 *
 *   - `disallow` — no action may be begun that cannot be paid for. The prompt
 *     refuses a larger number outright.
 *   - `finishFirst` — the action is begun, the pool is emptied, and what is
 *     still owed is paid out of the next round's pool. That character resolves
 *     before anybody else acts, because the unfinished action is completed
 *     first.
 *
 * Note that neither leaves a pool below zero. An earlier version of this system
 * carried the shortfall as a negative pool, which is not how either rule works.
 */
CNS5.overspendRules = {
  disallow: "CNS5.Settings.overspend.disallow",
  finishFirst: "CNS5.Settings.overspend.finishFirst"
};

/* -------------------------------------------- */
/*  Talents and flaws                           */
/* -------------------------------------------- */

/** What sort of blemish a flaw item records. */
CNS5.flawKinds = {
  deficiency: "CNS5.Flaw.kind.deficiency",
  phobia: "CNS5.Flaw.kind.phobia",
  curse: "CNS5.Flaw.kind.curse"
};

/**
 * Phobia intensity and the Willpower penalty for facing it (p94).
 *
 * A minor phobia has a 13% chance of turning out to be major, and each major
 * one a further 13% chance of being severe.
 */
CNS5.phobiaSeverities = {
  minor: { label: "CNS5.Flaw.severity.minor", willpower: -10 },
  major: { label: "CNS5.Flaw.severity.major", willpower: -20 },
  severe: { label: "CNS5.Flaw.severity.severe", willpower: -30 }
};

/** The chance that a phobia proves a degree worse than rolled (p94). */
CNS5.phobiaEscalationChance = 13;

/**
 * Ways of resisting fear other than a straight Willpower roll (p94).
 *
 * A character of Ferocity 16 or better may use their FER Attribute Roll
 * instead, and pious laity may take a flat penalty rather than roll at all.
 */
CNS5.fearAlternatives = {
  ferocity: { minimum: 16, label: "CNS5.Fear.ferocity" },
  piety: { modifier: -15, label: "CNS5.Fear.piety" }
};

/**
 * Table - Special Abilities Outcomes (p88): how many talents a character gets.
 */
CNS5.talentOutcomes = [
  { max: 3, count: 3, label: "CNS5.Talent.outcome.three" },
  { max: 9, count: 2, label: "CNS5.Talent.outcome.two" },
  { max: 50, count: 1, label: "CNS5.Talent.outcome.one" },
  { max: 99, count: 0, label: "CNS5.Talent.outcome.none" },
  { max: 100, count: 1, label: "CNS5.Talent.outcome.choose", choose: true }
];

/** A character with a talent must roll for a flaw; 01-40 gives one (p94). */
CNS5.flawChance = 40;

/* -------------------------------------------- */
/*  Defences                                    */
/* -------------------------------------------- */

/**
 * The two ways of resolving a defence (p270).
 *
 * Basic folds the defence into the attacker's chance: the attacker's Total
 * Success Chance is reduced by a share of the defender's Personal Skill Factor,
 * and one roll settles it.
 *
 * Advanced rolls separately for attack and defence and reads the pair, which is
 * what makes a shield able to absorb a blow it stopped.
 */
CNS5.defenceModes = {
  basic: "CNS5.Settings.defence.basic",
  advanced: "CNS5.Settings.defence.advanced"
};

/**
 * How much of the defender's PSF% comes off the attacker under basic combat
 * (p270): half for an active defence, a quarter for a passive one.
 */
CNS5.defenceShare = { active: 0.5, passive: 0.25 };

/**
 * The defences a target may declare.
 *
 * All three active defences cost Fatigue Points but no Action Points (p278), so
 * a character may defend whether or not they have any pool left. Which skill
 * each uses decides both the chance and, under basic combat, what comes off the
 * attacker.
 */
CNS5.defences = {
  none: { label: "CNS5.Defence.none", stance: null, skill: null },
  dodge: { label: "CNS5.Defence.dodge", stance: "active", skill: "Dodge" },
  weaponParry: { label: "CNS5.Defence.weaponParry", stance: "active", skill: null },
  shieldBlock: { label: "CNS5.Defence.shieldBlock", stance: "active", skill: null },
  passive: { label: "CNS5.Defence.passive", stance: "passive", skill: null }
};

/**
 * A weapon parry is made at the defender's skill less the attacker's PSF%,
 * and a dodge at the dodger's less the penalty for what they are wearing
 * (p278-280). A shield block instead gains the shield's own bonus.
 */
CNS5.defenceModifiers = {
  weaponParry: { opposedByAttackerPsf: true },
  dodge: { opposedByAttackerPsf: false },
  shieldBlock: { opposedByAttackerPsf: false }
};

/**
 * What gets past a weapon parry, by how the two weapons compare (p279).
 *
 * A parry with a weapon of the same weight stops everything. One step lighter
 * and the base damage still lands; two steps and the Crit Die lands with it. A
 * light weapon cannot parry a two-handed weapon or polearm at all without a
 * Critical Success.
 */
/**
 * How heavy each weight class counts as when weapons are compared for a parry.
 *
 * The natural classes are not extra rungs on the ladder — a natural medium
 * weapon is a medium weapon for this purpose. Listing them in sequence made a
 * light weapon two steps below a medium one and let the Crit Die through a
 * parry that should have stopped it.
 */
CNS5.parryRank = {
  naturalLight: 0,
  light: 0,
  naturalMedium: 1,
  medium: 1,
  naturalHeavy: 2,
  heavy: 2,
  twoHanded: 3
};

/**
 * What a parry lets through, given how many steps lighter the defending weapon
 * is than the attacking one.
 *
 * @param {string} defending  the parrying weapon's weight class
 * @param {string} attacking  the attacking weapon's weight class
 * @returns {{base: boolean, crit: boolean, impossible: boolean}}
 */
CNS5.parryOutcome = function (defending, attacking) {
  const gap = (CNS5.parryRank[attacking] ?? 1) - (CNS5.parryRank[defending] ?? 1);

  if (gap <= 0) return { base: false, crit: false, impossible: false };
  if (gap === 1) return { base: true, crit: false, impossible: false };
  return {
    base: true,
    crit: true,
    // A light weapon cannot parry a two-handed weapon or polearm at all.
    impossible: defending === "light" && attacking === "twoHanded"
  };
};

/**
 * Every blow that gets past a shield risks breaking it: a cumulative ten per
 * cent, checked on a d100, and the chance stays with the shield afterwards
 * unless it is repaired (p279).
 */
CNS5.shieldFailureStep = 10;

/* -------------------------------------------- */
/*  Damage                                      */
/* -------------------------------------------- */

/**
 * How a blow is applied (pp.272, 282, and the worked example on p287).
 *
 * The ordinary part of the damage — the weapon's, plus Strength, plus the
 * Attacker's Bonus, plus the Crit Die — is reduced by the armour that covers
 * the damage type, and what is left comes off Fatigue Points until they are
 * gone and off Body Points thereafter.
 *
 * A Critical Success adds a further d10 which behaves quite differently: it
 * "is directly removed from the target's Body", ignoring both the armour and
 * whatever Fatigue the target has left. That is the whole of what a critical
 * bypasses — the rest of the blow is absorbed and soaked up as usual.
 */
CNS5.criticalBonusDie = "1d10";

/**
 * A combat advantage buys an undefended opportune attack at -20% TSC% (p272).
 * A critical failure hands one to the opponent, and costs the fumbler an
 * Agility roll to keep hold of their weapon.
 */
CNS5.opportuneAttackModifier = -20;

/**
 * Split a blow between what armour and Fatigue can absorb and what goes
 * straight to Body.
 *
 * @param {object} options
 * @param {number} options.damage     the ordinary damage, Crit Die included
 * @param {number} options.bonus      the critical's extra d10, if any
 * @param {number} options.absorption the armour covering this damage type
 * @param {number} options.fatigue    the target's Fatigue Points
 * @returns {object} what each pool loses
 */
CNS5.applyDamage = function ({
  damage = 0,
  bonus = 0,
  absorption = 0,
  fatigue = 0,
  critical = false,
  constitution = 0,
  bruising = false
}) {
  const absorbed = Math.min(damage, absorption);
  const throughArmour = Math.max(0, damage - absorbed);

  // A Critical Success puts the whole blow on the Body: "a hit that is a
  // Critical Success... has all of the damage, not absorbed by the shield or
  // armour taken off the Body of the character" (p281). Fatigue takes none of
  // it. An earlier reading had only the extra die bypassing Fatigue, which
  // understated a critical by however much Fatigue the target had left.
  //
  // The optional bruising rule does something similar for an ordinary blow:
  // anything past the target's Constitution is more than bruising can absorb
  // and goes to the Body instead (p281).
  let fromFatigue;
  if (critical) {
    fromFatigue = 0;
  } else if (bruising && throughArmour > constitution) {
    fromFatigue = 0;
  } else {
    fromFatigue = Math.min(throughArmour, Math.max(0, fatigue));
  }

  const toBodyFromBlow = throughArmour - fromFatigue;

  return {
    absorbed,
    throughArmour,
    fatigueLost: fromFatigue,
    // The critical's bonus die ignores armour and Fatigue alike.
    bodyLost: toBodyFromBlow + bonus,
    bodyFromBonus: bonus,
    // Why Fatigue was spared, for a card that must explain itself.
    bypassedFatigue: critical ? "critical" : fromFatigue === 0 && throughArmour > 0 ? "bruising" : null,
    total: throughArmour + bonus
  };
};

/* -------------------------------------------- */
/*  The Fatigue cost of defending               */
/* -------------------------------------------- */

/**
 * Table - Fatigue cost for Defence (p284).
 *
 * "Dodging, weapon parries and shield blocks all cost a weapon blow or
 * expenditure of fatigue." The cost falls with skill and rises with the weight
 * of what is interposed, and it is read against the same PSF% bands as
 * Table - Combat Actions, so `actionPointBands` picks the column.
 *
 * The table names Light, Medium and Heavy only. A two-handed weapon or polearm
 * is read as Heavy — there is nothing heavier for it to be — and a dodge costs
 * one whatever the defender's skill.
 *
 * The alternative Blows system on the same page uses this table as a count of
 * blows rather than of Fatigue. That system is not implemented; the figures are
 * the same either way.
 */
CNS5.defenceFatigue = {
  dodge: [1, 1, 1, 1, 1],
  light: [2, 2, 1, 1, 1],
  medium: [3, 2, 2, 2, 1],
  heavy: [3, 3, 2, 2, 2]
};

/**
 * How the weight classes a weapon can have map onto the three the Fatigue
 * table names.
 */
CNS5.defenceWeightOf = {
  naturalLight: "light",
  light: "light",
  naturalMedium: "medium",
  medium: "medium",
  naturalHeavy: "heavy",
  heavy: "heavy",
  twoHanded: "heavy"
};

/**
 * The Fatigue a declared defence costs.
 *
 * @param {string} weight  "dodge", or a weight class of the interposed item
 * @param {number} psf     the defender's PSF% in the defending skill
 * @returns {number}
 */
CNS5.defenceFatigueCost = function (weight, psf) {
  const key = weight === "dodge" ? "dodge" : CNS5.defenceWeightOf[weight] ?? weight;
  const row = CNS5.defenceFatigue[key] ?? CNS5.defenceFatigue.medium;
  const band = CNS5.actionPointBands.findIndex((b) => (Number(psf) || 0) <= b.max);
  return row[band];
};

/* -------------------------------------------- */
/*  Dice appearance                             */
/* -------------------------------------------- */

/**
 * Colour schemes for Dice So Nice, if it is installed.
 *
 * "Use a different coloured dice for the Crit Die" is the rulebook's own
 * suggestion (p36), and a sensible one: the Percentile Pair and the Crit Die
 * are read quite differently, and at a glance on a virtual table they are two
 * indistinguishable dice landing together.
 *
 * The Percentile Pair is deliberately left alone. A player's own dice are their
 * own, and recolouring everything would take that away to solve a problem that
 * only affects the one die.
 */
CNS5.diceColorsets = [
  {
    name: "cns5-crit",
    description: "CNS5.Dice.crit",
    category: "Chivalry & Sorcery",
    foreground: "#f2ede1",
    background: "#6d2723",
    outline: "#2b1210",
    edge: "#4a1a17",
    texture: "none",
    material: "plastic"
  },
  {
    name: "cns5-crit-bonus",
    description: "CNS5.Dice.critBonus",
    category: "Chivalry & Sorcery",
    foreground: "#1a1611",
    background: "#c8a03a",
    outline: "#5a4715",
    edge: "#7d611b",
    texture: "none",
    material: "metal"
  }
];

/* -------------------------------------------- */
/*  Where a blow lands                          */
/* -------------------------------------------- */

/**
 * The torso, unless a location is named.
 *
 * Hit locations are an optional rule attached to critical hits (p282), and the
 * location table gives the chest forty results in a hundred on its own. An
 * ordinary attack is a blow at the body, and it is the body's armour that
 * stops it.
 */
CNS5.defaultHitLocation = "body";

/**
 * Where an aimed shot strikes, for the areas that are not the torso. Used to
 * pick which worn armour absorbs the blow.
 */
CNS5.targetAreaLocations = {
  none: "body",
  chest: "body",
  abdomen: "body",
  groin: "body",
  arm: "limbs",
  upperArm: "limbs",
  lowerArm: "limbs",
  hand: "limbs",
  upperLeg: "limbs",
  lowerLeg: "limbs",
  foot: "limbs",
  head: "head",
  neck: "head",
  eyes: "head"
};

/* -------------------------------------------- */
/*  Armour coverage                             */
/* -------------------------------------------- */

/**
 * The parts of a body that can be struck, taken from Table - Aimed Shot
 * Modifiers (p272) so that coverage and called shots speak the same language.
 * Back is not in that table — a blow to the back is a blow to the chest as far
 * as the armour tables are concerned — so it is not separated here either.
 */
CNS5.bodyAreas = [
  "head", "eyes", "neck", "chest", "abdomen", "groin",
  "upperArm", "lowerArm", "hand", "upperLeg", "lowerLeg", "foot"
];

/**
 * Areas the aimed shot table names as a whole where armour is fitted in two
 * parts, and the die that settles which part a blow found.
 *
 * The table already asks for an upper or a lower leg by name but treats an arm
 * as one thing, while a vambrace and a rerebrace are two pieces. Where both
 * halves are protected alike the roll changes nothing, which is most of the
 * time; where they are not, it decides.
 *
 * The rulebook uses a d10 to settle this sort of question elsewhere — a leg hit
 * against a hauberk is decided that way (p263) — but gives no split for the arm,
 * so an even one is used.
 */
CNS5.areaSubdivisions = {
  arm: { die: "1d10", parts: [{ area: "upperArm", max: 5 }, { area: "lowerArm", max: 10 }] }
};

/**
 * Settle which part of a divided area a blow found.
 *
 * @param {string} area
 * @param {number} roll
 * @returns {string} the area struck
 */
CNS5.subdivideArea = function (area, roll) {
  const split = CNS5.areaSubdivisions[area];
  if (!split) return area;
  return split.parts.find((p) => roll <= p.max)?.area ?? split.parts.at(-1).area;
};

/**
 * What each class of armour protects.
 *
 * The book states this in the prose beside each table rather than in the table
 * itself:
 *
 *   - light body armour gives "protection to the arms, chest, back and
 *     abdomen, but not to the groin or legs" (p261);
 *   - heavy body armour "protects the arms, chest, back, abdomen and groin"
 *     (p262);
 *   - a hauberk protects "the entire body below the neck and to the knees", and
 *     "if a leg hit occurs, roll a 1D10 with 01-07 falling on the armour rather
 *     than the unprotected part of the leg" (p263);
 *   - full mail "is fitted from head to foot" (p263).
 *
 * Two things are read into it. Hands are covered from the hauberk upwards, on
 * the reasoning that armour enclosing the whole arm encloses what is on the end
 * of it, and the same for feet where the legs are covered — the tables list no
 * gauntlets or sabatons separately, so the alternative is bare hands inside a
 * suit of plate. And a tunic or doublet is taken to leave the hands bare, being
 * a garment rather than a harness.
 */
CNS5.armourClasses = {
  helmet: { label: "CNS5.ArmourClass.helmet", covers: ["head"] },
  coif: { label: "CNS5.ArmourClass.coif", covers: ["head", "neck"] },
  enclosedHelm: { label: "CNS5.ArmourClass.enclosedHelm", covers: ["head", "eyes"] },
  visoredHelm: { label: "CNS5.ArmourClass.visoredHelm", covers: ["head", "eyes", "neck"] },
  lightBody: {
    label: "CNS5.ArmourClass.lightBody",
    covers: ["chest", "abdomen", "upperArm", "lowerArm"]
  },
  heavyBody: {
    label: "CNS5.ArmourClass.heavyBody",
    covers: ["chest", "abdomen", "groin", "upperArm", "lowerArm"]
  },
  threeQuarter: {
    label: "CNS5.ArmourClass.threeQuarter",
    covers: [
      "chest", "abdomen", "groin", "upperArm", "lowerArm", "hand", "upperLeg", "lowerLeg"
    ],
    // A leg hit falls on the armour seven times in ten.
    partial: { upperLeg: 70, lowerLeg: 70 }
  },
  heavyBattle: {
    label: "CNS5.ArmourClass.heavyBattle",
    covers: [
      "chest", "abdomen", "groin", "upperArm", "lowerArm",
      "hand", "upperLeg", "lowerLeg", "foot"
    ]
  },
  superHeavy: {
    label: "CNS5.ArmourClass.superHeavy",
    covers: [
      "neck", "chest", "abdomen", "groin",
      "upperArm", "lowerArm", "hand", "upperLeg", "lowerLeg", "foot"
    ]
  }
};

/**
 * Whether a piece of armour covers a given area, and how surely.
 *
 * @param {object} armour  an armour item's system data
 * @param {string} area    one of CNS5.bodyAreas
 * @returns {number} the percentage chance the blow meets it, 0 to 100
 */
CNS5.coverageOf = function (armour, area) {
  const covers = armour?.covers ?? [];
  if (!covers.includes(area)) return 0;
  return armour.coverage?.[area] ?? 100;
};

/**
 * The order parts of the body are listed in on a sheet: head downwards, as an
 * illustration of a harness would show them.
 */
CNS5.protectionOrder = [
  "head", "eyes", "neck", "chest", "abdomen", "groin",
  "upperArm", "lowerArm", "hand", "upperLeg", "lowerLeg", "foot"
];

/**
 * Summarise what is worn, for a sheet.
 *
 * Armour is fitted over parts of a body, not over "the torso" — the coverage
 * rules speak of the chest, the abdomen and the groin separately, and there is
 * no such area as a torso for a cuirass to cover. Listing all eleven parts
 * against five damage types would be a wall of numbers, so parts that are
 * protected identically are gathered into one row.
 *
 * Gathering by what they are worth rather than by where they are is the point.
 * A fixed grouping of "arms and hands" would report a cuirass's sixteen against
 * a bare hand, because a cuirass covers the arm and not what is on the end of
 * it. Rows built from the figures cannot say that.
 *
 * @param {object} byArea  protection per body area
 * @returns {Array<object>} rows, each naming the parts it speaks for
 */
CNS5.summariseProtection = function (byArea) {
  const types = Object.keys(CNS5.damageTypes);
  const rows = [];

  for (const area of CNS5.protectionOrder) {
    const values = byArea[area] ?? {};
    const signature = types.map((t) => values[t] ?? 0).join("/");
    const previous = rows.at(-1);

    // A run of parts worth the same is one row; a change starts another.
    if (previous && previous.signature === signature) previous.areas.push(area);
    else rows.push({ signature, areas: [area], values });
  }

  return rows
    .filter((row) => types.some((t) => (row.values[t] ?? 0) > 0))
    .map((row) => ({
      ...row,
      key: row.areas.join("-"),
      label: row.areas.map((a) => `CNS5.TargetArea.${a}`)
    }));
};

/* -------------------------------------------- */
/*  Missiles                                    */
/*  (p257-258)                                  */
/* -------------------------------------------- */

/**
 * The five range brackets, in order.
 */
CNS5.rangeBands = ["short", "medium", "long", "extreme", "max"];

/**
 * What a launcher is loaded with.
 *
 * A bow is nothing without an arrow, and the two are not simply added: Table -
 * Missile Ranges gives a *pairing* its damage and its ranges, and a longbow
 * shooting war arrows reaches six hundred feet where the same bow shooting
 * armour-piercing arrows reaches four hundred and fifty. Neither figure belongs
 * to the bow.
 *
 * So ammunition is matched to a launcher by kind, and the pairing is looked up.
 */
CNS5.ammunitionKinds = {
  arrow: "CNS5.Ammunition.arrow",
  bolt: "CNS5.Ammunition.bolt",
  stone: "CNS5.Ammunition.stone"
};

/**
 * From a weapon's name to what it shoots or is shot from.
 *
 * Crossbow bolts are the confusing case. Hunting Bolts carry no crossbow's name
 * and go in any of them; the Light, Medium and Heavy Crossbow Bolts are each
 * made for their own weapon. Both are bolts, so both load a crossbow — whether
 * a heavy crossbow ought to accept a light bolt is a question the tables do not
 * answer, and the system does not presume to.
 */
/**
 * The skill a weapon is thrown with.
 *
 * Throwing is an action, not a kind of weapon. There is no throwing axe to buy
 * because what a character throws is the War Axe already on their belt, and the
 * rules give that its own skill — Hurling Axes (p165), whose prerequisite is
 * Axes, the skill it is swung with. The two are different skills with different
 * Difficulty Factors and different attributes, so which one applies depends on
 * what the character is doing rather than on what they are holding.
 *
 * @param {string} name
 * @returns {string} the skill's name, or empty if it cannot be thrown
 */
CNS5.hurlingSkillFor = function (name = "") {
  if (/axe/i.test(name) && !/pole ?axe/i.test(name)) return "Hurling Axes";
  if (/javelin|pilum|spear/i.test(name)) return "Hurling Javelins";
  if (/knife|knives|dagger|dirk|poignard|skean/i.test(name)) return "Throwing Knives & Daggers";
  if (/dart/i.test(name)) return "Throwing Objects";
  return "";
};

/**
 * What a launcher takes.
 *
 * This is a different question from what a missile *is*, and asking the wrong
 * one is silent: a bow's name contains no "arrow", so asking what kind of
 * missile a Short Bow is returned nothing, no ammunition was ever found to
 * match it, and every shot fell back to the default loading. Note that a
 * crossbow must be tested for before a bow, since its name contains one.
 *
 * @param {string} name
 * @returns {string} a key of CNS5.ammunitionKinds
 */
CNS5.ammunitionFor = function (name = "") {
  if (/crossbow|arbalest|arbelest/i.test(name)) return "bolt";
  if (/bow/i.test(name)) return "arrow";
  if (/sling|shepherd|staff/i.test(name)) return "stone";
  return "";
};

/**
 * What a missile is.
 *
 * @param {string} name
 * @returns {string} a key of CNS5.ammunitionKinds
 */
CNS5.ammunitionKindOf = function (name = "") {
  if (/arrow/i.test(name)) return "arrow";
  if (/bolt|quarrel/i.test(name)) return "bolt";
  if (/bullet|stone|shot/i.test(name)) return "stone";
  return "";
};

/**
 * Strength tells at a distance (p258).
 *
 * A character of Strength 12 or better modifies the Crit Die by the amount the
 * table gives for that missile at that range, and adds fifty feet of range per
 * point above twelve — but only at extreme and maximum range, where the shot is
 * a matter of how hard it was loosed rather than how carefully it was aimed.
 */
CNS5.rangedStrengthMinimum = 12;
CNS5.rangedStrengthRangePerPoint = 50;
CNS5.rangedStrengthRangeBands = ["extreme", "max"];

/**
 * Match a kind of ammunition to its row of the strength table.
 *
 * The two tables name things differently — "Lt X-Bowbolts" against "Light
 * Crossbow Bolts" — and anything unnamed falls to "Other Weapons", which is
 * what that row is for.
 *
 * @param {string} name
 * @returns {string} the row's name
 */
CNS5.rangedStrengthRow = function (name = "") {
  if (/ap|armour[- ]?piercing/i.test(name)) return "AP Arrows";
  if (/war arrow/i.test(name)) return "War Arrows";
  if (/arrow/i.test(name)) return "Hunting Arrows";
  if (/light.*bolt|lt.*bolt/i.test(name)) return "Lt X-Bowbolts";
  if (/medium.*bolt|mdm.*bolt/i.test(name)) return "Mdm X-Bowbolts";
  if (/heavy.*bolt|hvy.*bolt/i.test(name)) return "Hvy X-Bowbolts";
  if (/bolt/i.test(name)) return "Lt X-Bowbolts";
  if (/dart/i.test(name)) return "Darts";
  if (/war javelin/i.test(name)) return "War Javelins";
  if (/javelin/i.test(name)) return "Hunting Javelins";
  return "Other Weapons";
};

/**
 * The extra distance a strong arm adds to a bracket.
 *
 * @param {number} strength
 * @param {string} band
 * @returns {number} feet
 */
CNS5.rangedStrengthBonus = function (strength, band) {
  if (!CNS5.rangedStrengthRangeBands.includes(band)) return 0;
  const over = (Number(strength) || 0) - CNS5.rangedStrengthMinimum;
  return over > 0 ? over * CNS5.rangedStrengthRangePerPoint : 0;
};

/* -------------------------------------------- */
/*  Falling and dying                           */
/* -------------------------------------------- */

/**
 * What Body Points mean once they run out (p282).
 *
 * "Once a character reaches zero body he slips into unconsciousness. A
 * character can suffer damage that places his body into negative figures, but
 * once this happens death may rapidly follow. When the character's Body Points
 * reach a negative figure equal to the level of the character's Constitution,
 * the character is dead."
 *
 * So the margin between falling and dying is the character's own Constitution:
 * a hardy man has further to go. Body is deliberately allowed below zero rather
 * than floored there, because the distance below zero is the whole of what
 * decides the question.
 */
CNS5.deathThreshold = function (constitution) {
  return -(Number(constitution) || 0);
};

/**
 * Work out what state a character is in.
 *
 * @param {number} body          current Body Points
 * @param {number} constitution  the character's Constitution
 * @returns {{state: string, dying: boolean, margin: number, deathAt: number}}
 */
CNS5.vitalState = function (body, constitution) {
  const deathAt = CNS5.deathThreshold(constitution);
  const value = Number(body) || 0;

  const state = value <= deathAt ? "dead" : value <= 0 ? "unconscious" : "standing";

  return {
    state,
    // How much further a character can be hurt before dying.
    margin: Math.max(0, value - deathAt),
    deathAt,
    dying: state === "unconscious",
    dead: state === "dead"
  };
};

/* -------------------------------------------- */
/*  Combat advantages                           */
/* -------------------------------------------- */

/**
 * Table - Combat Advantages (p280): what a follow-up costs in Fatigue.
 *
 * A defence that succeeds against a failed attack hands the defender an
 * advantage, and taking it up costs Fatigue by the weight of what they use.
 */
CNS5.combatAdvantageCost = {
  natural: 0,
  light: 1,
  medium: 2,
  heavy: 3,
  twoHanded: 4,
  polearm: 4
};

/**
 * How a weapon's weight class maps onto that table.
 */
CNS5.advantageWeightOf = {
  naturalLight: "natural",
  naturalMedium: "natural",
  naturalHeavy: "natural",
  light: "light",
  medium: "medium",
  heavy: "heavy",
  twoHanded: "twoHanded"
};

/**
 * What a defence entitles its maker to (p280-281).
 *
 * An ordinary success lets the defender attack in turn if they are next in
 * line. A Critical Success does more, and what it does depends on what was
 * interposed: a shield may be bashed with the opponent's balance lost, a dodge
 * leaves the attacker open to any weapon, and a parry may be turned into a
 * disarm — against which the attacker must make a Strength roll penalised by
 * the defender's own skill.
 */
CNS5.combatAdvantages = {
  shieldBlock: {
    label: "CNS5.Advantage.shieldBash",
    bonus: 10,
    skill: "shield",
    criticalOnly: true
  },
  dodge: {
    label: "CNS5.Advantage.openings",
    bonus: 10,
    skill: "weapon",
    criticalOnly: true
  },
  weaponParry: {
    label: "CNS5.Advantage.disarm",
    bonus: 0,
    skill: "weapon",
    criticalOnly: true,
    // The attacker rolls Strength against the defender's skill to keep hold of
    // the weapon, rather than the defender rolling to take it.
    opposedByStrength: true
  }
};

/** A two-handed weapon or polearm may only counter-attack under conditions. */
CNS5.advantageRestricted = ["twoHanded", "polearm"];

/**
 * Damage on a Critical Success, and whether the extra die explodes.
 *
 * "If the character rolls a 10 on the additional 1D10, then the 1D10 can be
 * re-rolled and the new result added to the previous total" (p281) — an
 * optional rule, and the one that makes a lucky blow catastrophic.
 */
CNS5.criticalBonusExplodes = "1d10x10";

/* -------------------------------------------- */
/*  Targeting a spell                           */
/*  (pp.296-298)                                */
/* -------------------------------------------- */

/**
 * The mana of a place, and what it costs to draw on (p296).
 *
 * "In an average Mana level environment the costs to perform Magick are as
 * indicated for the spell. In a low Mana environment the Fatigue costs are
 * doubled... In a high Mana environment the Fatigue costs are halved. The
 * Shadow World... is considered to be a High Mana environment and gives a bonus
 * of +10% to any Method of Magick or Mode of Magick TSC%."
 */
CNS5.manaLevels = {
  low: { label: "CNS5.Mana.low", fatigue: 2, tsc: 0 },
  average: { label: "CNS5.Mana.average", fatigue: 1, tsc: 0 },
  high: { label: "CNS5.Mana.high", fatigue: 0.5, tsc: 0 },
  shadow: { label: "CNS5.Mana.shadow", fatigue: 0.5, tsc: 10 }
};

/**
 * Where the casting comes from, and what that does to its cost (p297).
 *
 * A spell read from a page costs half what one held in the head does, and a
 * device does much of the work itself — a quarter of the cost for a Mage who
 * knows what he is doing with it, half for anyone else, and a charge either
 * way. A Focus is listed because it belongs here, though what it costs is
 * settled under the making of Magickal Items and is not yet implemented.
 */
CNS5.castingSources = {
  memory: { label: "CNS5.Casting.memory", fatigue: 1, charge: false },
  scroll: { label: "CNS5.Casting.scroll", fatigue: 0.5, charge: false },
  deviceMage: { label: "CNS5.Casting.deviceMage", fatigue: 0.25, charge: true },
  deviceOther: { label: "CNS5.Casting.deviceOther", fatigue: 0.5, charge: true },
  focus: { label: "CNS5.Casting.focus", fatigue: 1, charge: false, unimplemented: true }
};

/**
 * Doubling the Fatigue spent extends a spell's reach by half again (p296).
 */
CNS5.rangeExtension = { fatigue: 2, distance: 1.5 };

/**
 * A target who wants the spell is far easier to reach (p296).
 */
CNS5.willingTargetBonus = 50;

/**
 * A physical effect may be dodged, but only by someone who can see it coming
 * and has room to move: "the target needs to be fully alert... and a minimum of
 * 50 feet from the caster" (p296). Their Dodge PSF comes off the caster.
 */
CNS5.spellDodgeMinimumDistance = 50;

/**
 * What a spell costs to cast, given where it is drawn from and where it is
 * being cast.
 *
 * The Fatigue is rounded up, as the rules say of a halved cost, and the two
 * multipliers apply together: a scroll read in a high mana place costs a
 * quarter of what memory costs in a low one.
 *
 * @param {object} options
 * @returns {{fatigue: number, extended: boolean, charge: boolean}}
 */
CNS5.spellCost = function ({ base = 0, mana = "average", source = "memory", extendRange = false }) {
  const place = CNS5.manaLevels[mana] ?? CNS5.manaLevels.average;
  const from = CNS5.castingSources[source] ?? CNS5.castingSources.memory;
  const extension = extendRange ? CNS5.rangeExtension.fatigue : 1;

  return {
    fatigue: Math.ceil(base * place.fatigue * from.fatigue * extension),
    extended: extendRange,
    charge: from.charge,
    tscBonus: place.tsc
  };
};
