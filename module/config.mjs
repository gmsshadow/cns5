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
CNS5.applyDamage = function ({ damage = 0, bonus = 0, absorption = 0, fatigue = 0 }) {
  const absorbed = Math.min(damage, absorption);
  const throughArmour = Math.max(0, damage - absorbed);

  // Fatigue takes the blow first and Body takes the remainder.
  const fromFatigue = Math.min(throughArmour, Math.max(0, fatigue));
  const toBodyFromBlow = throughArmour - fromFatigue;

  return {
    absorbed,
    throughArmour,
    fatigueLost: fromFatigue,
    // The critical's bonus die ignores armour and Fatigue alike.
    bodyLost: toBodyFromBlow + bonus,
    bodyFromBonus: bonus,
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
