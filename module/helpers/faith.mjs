import { CNS5 } from "../config.mjs";

/**
 * Reading what an Act of Faith asks for (pp.404, 441-454).
 *
 * "SC: Success Chance that the benefit flows to the recipient." It is written
 * as a formula rather than a number, because it is measured against whoever is
 * concerned and against whichever of their figures the Act turns on:
 *
 *     Faith TSC%
 *     2/3 Faith TSC%
 *     Faith TSC% -30
 *     Supplicant's Spirit AR
 *     1/2 Recipient's Faith TSC, then 2/3 Cleric's PFF
 *
 * The grammar is regular: an optional fraction, whose figure it is, which
 * figure, and an optional modifier. Clauses joined by "then" are rolled one
 * after another and all must succeed; "plus" adds a figure into the same roll;
 * a semicolon separates alternatives the Gamemaster chooses between.
 */

/** The fractions the book writes, in both its forms. */
const FRACTIONS = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75,
  "1/2": 0.5, "1/3": 1 / 3, "2/3": 2 / 3, "1/4": 0.25, "3/4": 0.75
};

/** Whose figure is meant. Everyone but the recipient is the one performing. */
const RECIPIENT = /recipient|victim/i;

/** Which figure. */
const STATISTICS = [
  [/spirit\s*ar/i, "spiritAr"],
  [/pff/i, "pff"],
  [/faith\s*(tsc)?%?/i, "faithTsc"]
];

const FRACTION_PATTERN = Object.keys(FRACTIONS)
  .map((f) => f.replace("/", "\\/"))
  .join("|");

/**
 * Read one clause: "2/3 Cleric's PFF", "Faith TSC% -30".
 *
 * @param {string} text
 * @returns {object|null}
 */
function parseClause(text) {
  const clause = text.trim();
  if (!clause) return null;

  const fraction = new RegExp(`^(${FRACTION_PATTERN})\\s*`).exec(clause);
  const rest = fraction ? clause.slice(fraction[0].length) : clause;

  const statistic = STATISTICS.find(([pattern]) => pattern.test(rest));
  if (!statistic) return null;

  // "-30", "+ PFF" handled separately; only a bare signed number is a modifier.
  const modifier = /(?:^|\s)([-+]\s?\d+)(?!\d)/.exec(rest);

  return {
    fraction: fraction ? FRACTIONS[fraction[1]] : 1,
    of: RECIPIENT.test(rest) ? "recipient" : "performer",
    statistic: statistic[1],
    modifier: modifier ? Number(modifier[1].replace(/\s/g, "")) : 0,
    text: clause
  };
}

/**
 * Read a success chance into the rolls it asks for.
 *
 * @param {string} text  as the description prints it
 * @returns {{variants: Array<Array<object>>, unread: string|null}}
 */
export function parseFaithChance(text) {
  const raw = (text ?? "").trim();
  if (!raw) return { variants: [], unread: null };

  const variants = [];
  for (const variant of raw.split(";")) {
    const steps = [];
    // "then" starts another roll; "plus" or "+" adds into the one before it.
    for (const piece of variant.split(/,?\s*\bthen\b\s*/i)) {
      const [first, ...added] = piece.split(/,?\s*(?:\bplus\b|\+(?=\s*[^\d]))\s*/i);
      const step = parseClause(first);
      if (!step) continue;

      step.added = added.map(parseClause).filter(Boolean);
      steps.push(step);
    }
    if (steps.length) variants.push(steps);
  }

  return { variants, unread: variants.length ? null : raw };
}

/* -------------------------------------------- */

/**
 * Read a cost: "-3 FP from Supplicant", "-Crit Die FP from Cleric",
 * "-1/3 total FP from Cleric", "-1 FP from Supplicant per hour".
 *
 * An offering — "Recipient offers S5" — is a sacrifice on the book's own scale
 * and is carried through as written, being the Gamemaster's to adjudicate.
 *
 * @param {string} text
 * @returns {{charges: Array<object>, offering: string|null, unread: string|null}}
 */
export function parseFaithCost(text) {
  const raw = (text ?? "").trim();
  if (!raw) return { charges: [], offering: null, unread: null };

  const offering = /\bS(\d)\b/.exec(raw);
  const charges = [];

  for (const piece of raw.split(/[;.]/)) {
    const clause = piece.trim();
    if (!clause || /offers?\s+S\d/i.test(clause)) continue;

    const from = /from\s+([A-Za-z]+)/i.exec(clause);
    const who = from && RECIPIENT.test(from[1]) ? "recipient" : "performer";

    if (/crit\s*die/i.test(clause)) {
      charges.push({ critDie: true, of: who, perHour: false, text: clause });
      continue;
    }

    const fraction = new RegExp(`-?(${FRACTION_PATTERN})\\s*total`, "i").exec(clause);
    if (fraction) {
      charges.push({
        fractionOfTotal: FRACTIONS[fraction[1]], of: who, perHour: false, text: clause
      });
      continue;
    }

    const flat = /-\s?(\d+)\s*(?:FP)?/i.exec(clause);
    if (flat) {
      charges.push({
        fatigue: Number(flat[1]),
        of: who,
        perHour: /per\s+hour/i.test(clause),
        text: clause
      });
    }
  }

  return {
    charges,
    offering: offering ? `S${offering[1]}` : null,
    unread: charges.length || offering ? null : raw
  };
}

/* -------------------------------------------- */

/**
 * What a figure is worth for a given person.
 *
 * Faith TSC% is the character's chance in the Faith skill; PFF his Personal
 * Faith Factor; a Spirit AR the Attribute Roll on Spirit.
 *
 * @param {Actor|null} actor
 * @param {string} statistic
 * @returns {number}
 */
export function faithStatistic(actor, statistic) {
  if (!actor) return 0;

  switch (statistic) {
    case "faithTsc":
      return actor.system.faith?.skillItem?.system.tsc ?? 0;
    case "pff":
      return actor.system.faith?.pff ?? 0;
    case "spiritAr":
      return CNS5.attributeRoll(actor.system.attr?.spr?.value ?? 0);
    default:
      return 0;
  }
}

/**
 * Work a step of a success chance out for the people concerned.
 *
 * @param {object} step
 * @param {{performer: Actor, recipient: Actor|null}} people
 * @returns {{chance: number, parts: Array}}
 */
export function faithChanceFor(step, { performer, recipient }) {
  const who = (of_) => (of_ === "recipient" ? recipient : performer);
  const parts = [];

  const value = (clause) => {
    const base = faithStatistic(who(clause.of), clause.statistic);
    const figure = Math.round(base * clause.fraction) + clause.modifier;
    parts.push({ label: clause.text, value: figure });
    return figure;
  };

  const chance = [step, ...(step.added ?? [])].reduce((total, clause) => total + value(clause), 0);
  return { chance, parts };
}
