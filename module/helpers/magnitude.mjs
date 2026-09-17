import { CNS5 } from "../config.mjs";

/**
 * Reading the ranges and durations the spell tables print.
 *
 * Nearly every one is a quantity multiplied by the caster's Magick Level:
 * "10' x ML", "3 min x ML", "1 mile x ML". Some add a fixed part — "5' + 1' per
 * ML" — one subtracts — "60 seconds - (5 x ML)" — and a good many are a word
 * instead: Touch, Self, Instant, Permanent.
 *
 * A word is not a failure to parse. A spell cast by touch has no range in feet
 * and never will, so it is carried through as what it is rather than turned
 * into a nought that would read as "no range at all".
 */

/** How the tables write each unit, and what it is worth in feet or seconds. */
const UNITS = {
  distance: {
    "’": 1, "'": 1, ft: 1, feet: 1, foot: 1,
    yard: 3, yards: 3,
    mile: 5280, miles: 5280,
    // An acre is an area rather than a distance; the tables use it for spells
    // that cover ground, and its side is the useful figure.
    acre: 209, acres: 209
  },
  time: {
    second: 1, seconds: 1, sec: 1, secs: 1,
    min: 60, mins: 60, minute: 60, minutes: 60,
    hour: 3600, hours: 3600, hr: 3600,
    day: 86_400, days: 86_400,
    week: 604_800, weeks: 604_800,
    month: 2_592_000, months: 2_592_000,
    year: 31_536_000, years: 31_536_000
  }
};

/** Words that stand in place of a quantity, and what they mean. */
const WORDS = {
  touch: "CNS5.Magnitude.touch",
  "touch/self": "CNS5.Magnitude.touchSelf",
  self: "CNS5.Magnitude.self",
  drink: "CNS5.Magnitude.drink",
  sight: "CNS5.Magnitude.sight",
  instant: "CNS5.Magnitude.instant",
  permanent: "CNS5.Magnitude.permanent",
  engagement: "CNS5.Magnitude.engagement",
  "until dispelled": "CNS5.Magnitude.untilDispelled",
  "till cast": "CNS5.Magnitude.tillCast",
  fuel: "CNS5.Magnitude.fuel",
  spec: "CNS5.Magnitude.special",
  var: "CNS5.Magnitude.variable",
  special: "CNS5.Magnitude.special"
};

/* -------------------------------------------- */

/**
 * Read a printed range or duration.
 *
 * @param {string} text  as the table prints it
 * @param {string} kind  "distance" or "time"
 * @returns {object} what it is, and how to work it out
 */
export function parseMagnitude(text, kind = "distance") {
  const raw = (text ?? "").trim();
  if (!raw || raw === "-") return { kind: "none", raw };

  const word = WORDS[raw.toLowerCase()];
  if (word) return { kind: "word", label: word, raw };

  // A trailing "r" marks a radius rather than a reach. It changes the shape of
  // the effect, not its size, so it is noted and set aside.
  const radius = /\s+r$/i.test(raw);
  const body = radius ? raw.replace(/\s+r$/i, "") : raw;

  const units = UNITS[kind];
  const pattern = Object.keys(units)
    .sort((a, b) => b.length - a.length)
    .map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  // A number, optionally a fraction or with thousands separators, then a unit.
  const quantity = String.raw`(\d[\d,]*(?:\s*\/\s*\d+)?(?:\.\d+)?)\s*(${pattern})?`;

  // "10' x ML", "5' + 1' per ML", "60 seconds - (5 x ML)"
  const perLevel = new RegExp(
    `^${quantity}\\s*(?:x|per)\\s*ML(?:\\s*x\\s*(\\w+))?`, "i"
  );
  const fixedPlus = new RegExp(
    `^${quantity}\\s*\\+\\s*${quantity}\\s*(?:x|per)\\s*ML`, "i"
  );
  const fixedMinus = new RegExp(
    `^${quantity}\\s*-\\s*\\(?\\s*${quantity}\\s*(?:x|per)?\\s*ML\\s*\\)?$`, "i"
  );

  const number = (value) => {
    if (!value) return 0;
    const cleaned = value.replace(/,/g, "").trim();
    const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(cleaned);
    return fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(cleaned);
  };

  const dividedByLevel = new RegExp(`^${quantity}\\s*\\/\\s*ML$`, "i");
  let m = dividedByLevel.exec(body);
  if (m) {
    return {
      kind: "formula", raw, radius,
      fixed: 0,
      perLevel: 0,
      dividend: number(m[1]) * (units[m[2]?.toLowerCase()] ?? 1),
      unit: kind
    };
  }

  m = fixedPlus.exec(body);
  if (m) {
    return {
      kind: "formula", raw, radius,
      fixed: number(m[1]) * (units[m[2]?.toLowerCase()] ?? 1),
      perLevel: number(m[3]) * (units[m[4]?.toLowerCase()] ?? units[m[2]?.toLowerCase()] ?? 1),
      unit: kind
    };
  }

  m = fixedMinus.exec(body);
  if (m) {
    const scale = units[m[2]?.toLowerCase()] ?? 1;
    return {
      kind: "formula", raw, radius,
      fixed: number(m[1]) * scale,
      perLevel: -number(m[3]) * (units[m[4]?.toLowerCase()] ?? scale),
      unit: kind
    };
  }

  m = perLevel.exec(body);
  if (m) {
    return {
      kind: "formula", raw, radius,
      fixed: 0,
      perLevel: number(m[1]) * (units[m[2]?.toLowerCase()] ?? 1),
      unit: kind,
      // "10' x ML x Density" has a term only the Gamemaster can supply.
      unknown: m[3] ?? null
    };
  }

  // A quantity scaled by something other than the caster's level: Volume,
  // Density, degrees of heat. Only the Gamemaster can supply those, so the
  // term is named and no figure is invented for it.
  const perOther = new RegExp(`^${quantity}\\s*(?:x|per|for)\\s+(.+)$`, "i");
  m = perOther.exec(body);
  if (m) {
    return {
      kind: "formula", raw, radius,
      fixed: 0,
      perLevel: number(m[1]) * (units[m[2]?.toLowerCase()] ?? 1),
      unit: kind,
      unknown: m[3].trim()
    };
  }

  // A bare quantity with no Magick Level in it.
  m = new RegExp(`^${quantity}\\s*$`, "i").exec(body);
  if (m) {
    return {
      kind: "formula", raw, radius,
      fixed: number(m[1]) * (units[m[2]?.toLowerCase()] ?? 1),
      perLevel: 0,
      unit: kind
    };
  }

  // Not a quantity at all. The rulebook says things like "Per Type of Fire",
  // which is an instruction to the Gamemaster rather than a figure, so it is
  // carried through as printed rather than reported as a failure to read.
  return { kind: "asPrinted", raw };
}

/* -------------------------------------------- */

/**
 * Work a parsed magnitude out for a given Magick Level.
 *
 * @param {object} parsed
 * @param {number} level
 * @returns {number|null} feet or seconds, or null where there is no number
 */
export function evaluateMagnitude(parsed, level = 1) {
  if (parsed?.kind !== "formula" || parsed.unknown) return null;

  const ml = Math.max(1, level);
  // A few spells are quicker the better the mage: "60 min / ML".
  if (parsed.dividend) return Math.max(0, Math.round(parsed.dividend / ml));

  return Math.max(0, Math.round(parsed.fixed + parsed.perLevel * Math.max(0, level)));
}

/* -------------------------------------------- */

/**
 * The three range brackets of a spell.
 *
 * The figure the spell tables print is the *maximum*: "Short Range (10% of Max
 * Range), Long Range (50% of Max Range), Maximal Range" (p296). So the other
 * two are worked out from it rather than entered by hand, and a sheet that
 * asked for all three was asking for something the rules derive.
 *
 * @param {object} parsed  the printed range
 * @param {number} level   the caster's Magick Level
 * @returns {{short: number, long: number, max: number}|null}
 */
export function spellRangeBands(parsed, level = 1) {
  const max = evaluateMagnitude(parsed, level);
  if (max === null) return null;

  return {
    short: Math.round(max * CNS5.spellRangeShare.short),
    long: Math.round(max * CNS5.spellRangeShare.long),
    max
  };
}

/* -------------------------------------------- */

/**
 * Put a number of feet or seconds into words a player reads.
 *
 * @param {number} value
 * @param {string} kind
 * @returns {string}
 */
export function describeMagnitude(value, kind = "distance") {
  if (value === null || value === undefined) return "";

  if (kind === "time") {
    if (value >= 86_400) return `${round(value / 86_400)} ${plural(value / 86_400, "day")}`;
    if (value >= 3600) return `${round(value / 3600)} ${plural(value / 3600, "hour")}`;
    if (value >= 60) return `${round(value / 60)} ${plural(value / 60, "minute")}`;
    return `${round(value)} ${plural(value, "second")}`;
  }

  if (value >= 5280) return `${round(value / 5280)} ${plural(value / 5280, "mile")}`;
  return `${round(value)} ft`;
}

const round = (n) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10);
const plural = (n, word) => (round(n) === 1 ? word : `${word}s`);
