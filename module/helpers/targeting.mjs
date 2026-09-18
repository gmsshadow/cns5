import { CNS5 } from "../config.mjs";

/**
 * Targeting a spell (pp.296-298).
 *
 * Casting a spell and targeting it are separate acts. Casting makes the
 * pattern; targeting carries it through the Shadow World to where it is wanted,
 * and it is targeting that everything in the way interferes with.
 *
 * The caster's chance is their Method of Magick — the school, not the
 * tradition — less the target's own resistance, less whatever stands between them, adjusted for how either is
 * moving and how far apart they are — and raised by half again if the target
 * wants the spell.
 */

let tables = null;

/**
 * Load the targeting tables once.
 * @returns {Promise<object>}
 */
export async function magickTables() {
  if (tables) return tables;
  tables = await foundry.utils.fetchJsonWithTimeout("systems/cns5/data/magick.json");
  return tables;
}

/* -------------------------------------------- */

/**
 * What a target resists a spell by, before anything else is counted.
 *
 * Read from what the target is: a Lich resists forty per cent where a human
 * resists nothing. A character's race is free text, so it is matched loosely
 * and falls back to nothing rather than guessing.
 *
 * @param {Actor|null} target
 * @param {object} resistance  the table
 * @returns {{value: number, matched: string|null}}
 */
export function intrinsicResistance(target, resistance) {
  const race = (target?.system?.details?.race ?? "").trim().toLowerCase();
  if (!race) return { value: 0, matched: null };

  // An exact name first, then anything the race contains — "Wood Elf" before
  // "Elf", so the more particular answer wins.
  const names = Object.keys(resistance).sort((a, b) => b.length - a.length);
  const hit = names.find((name) => {
    const key = name.toLowerCase();
    return race === key || race.includes(key) || key.includes(race);
  });

  return hit ? { value: resistance[hit], matched: hit } : { value: 0, matched: null };
}

/* -------------------------------------------- */

/**
 * Gather everything that bears on a targeting roll.
 *
 * @param {object} options
 * @returns {object} the parts, and what they come to
 */
export function resolveTargeting({
  methodTsc = 0,
  resistance = 0,
  range = "short",
  movement = [],
  obstacles = [],
  willing = false,
  dodgePsf = 0,
  manaBonus = 0,
  situational = 0,
  tables: loaded = null
}) {
  const data = loaded ?? tables ?? { movement: [], obstacles: [] };

  const byId = (list, source) =>
    list.map((id) => source.find((entry) => entry.id === id)).filter(Boolean);

  const moves = byId(movement, data.movement ?? []);
  const blocks = byId(obstacles, data.obstacles ?? []);

  // True Lead is not a penalty. No spell passes it, and adding up numbers to
  // arrive at "very unlikely" would misstate a rule that says "never".
  const impenetrable = blocks.find((entry) => entry.impenetrable);

  const band = CNS5.spellRanges[range] ?? CNS5.spellRanges.short;
  const movementTotal = moves.reduce((sum, entry) => sum + entry.modifier, 0);
  const obstacleTotal = blocks.reduce((sum, entry) => sum + (entry.modifier ?? 0), 0);

  const total =
    methodTsc -
    resistance +
    band.modifier +
    movementTotal +
    obstacleTotal +
    (willing ? CNS5.willingTargetBonus : 0) -
    dodgePsf +
    manaBonus +
    situational;

  return {
    impenetrable: Boolean(impenetrable),
    impenetrableBy: impenetrable?.label ?? null,
    methodTsc,
    resistance,
    rangeModifier: band.modifier,
    movement: moves,
    movementTotal,
    obstacles: blocks,
    obstacleTotal,
    willing,
    willingBonus: willing ? CNS5.willingTargetBonus : 0,
    dodgePsf,
    manaBonus,
    situational,
    total
  };
}
