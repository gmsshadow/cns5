import { CNS5 } from "../config.mjs";

/**
 * Missile attacks (pp.257-258).
 *
 * A bow and its arrows are one weapon for as long as the arrow is on the
 * string. Table - Missile Ranges is a table of those pairings, not of weapons:
 * it gives each pairing a composite damage and five range brackets, each with a
 * Crit Die modifier of its own. The same longbow reaches eight hundred feet
 * with hunting arrows and four hundred and fifty with armour-piercing ones, so
 * there is no sense in which the range belongs to the bow.
 *
 * Thrown weapons are their own ammunition and have a profile to themselves.
 */

let profiles = null;

/**
 * Load the profiles once.
 *
 * They are shipped as data rather than held in config because there are
 * twenty-five of them and they are extracted from the book rather than written
 * by hand.
 *
 * @returns {Promise<object>}
 */
export async function missileData() {
  if (profiles) return profiles;
  const response = await foundry.utils.fetchJsonWithTimeout(
    "systems/cns5/data/missiles.json"
  );
  profiles = response;
  return profiles;
}

/* -------------------------------------------- */

/**
 * Names differ between the tables and the weapon list: "Composite. Bow" against
 * "Composite Bow", "Mdm. Crossbow" against "Medium Crossbow". Comparing them
 * without their punctuation and abbreviations settles it.
 *
 * @param {string} name
 * @returns {string}
 */
function normalise(name = "") {
  const stripped = name
    .toLowerCase()
    .replace(/\bmdm\b\.?/g, "medium")
    .replace(/\blt\b\.?/g, "light")
    .replace(/\bhvy\b\.?/g, "heavy")
    .replace(/\bap\b/g, "armourpiercing")
    .replace(/[^a-z0-9]/g, "");

  // The two tables name several things differently, and a near miss is silent:
  // a Throwing Knife found no row called "Thrown Knife", so the attack fell
  // through to a melee blow with no range asked for at all.
  for (const [pattern, canonical] of ALIASES) {
    if (pattern.test(stripped)) return canonical;
  }
  return stripped;
}

/** Names that differ between the weapon list and the ranges table. */
const ALIASES = [
  [/^throw(ing|n)knives?$/, "thrownknife"],
  [/^throw(ing|n)axe/, "thrownaxe"],
  [/pilum/, "pilum"],
  [/dart/, "dart"],
  [/^shepherd/, "shepherdssling"],
  [/^huntingjavelin/, "huntingjavelin"],
  [/^warjavelin/, "warjavelin"],
  [/armourpiercingarrow/, "armourpiercingarrow"],
  [/^wararrow/, "wararrow"],
  [/^huntingarrow/, "huntingarrows"],
  [/^leadbullet/, "leadbullets"],
  [/^compositebow/, "compositebow"]
];

/** Exposed so the name matching can be checked without a Foundry to run in. */
export const normaliseForTest = normalise;

/* -------------------------------------------- */

/**
 * Find the profile for a weapon, and the ammunition it is loaded with.
 *
 * @param {Item} weapon
 * @param {Item|null} ammunition
 * @returns {Promise<object|null>}
 */
export async function missileProfile(weapon, ammunition = null) {
  const data = await missileData();
  const wanted = normalise(weapon.name);

  const matches = data.profiles.filter((p) => normalise(p.weapon) === wanted);
  if (!matches.length) return null;

  if (!ammunition) {
    // A launcher with nothing named is loaded with whatever it ordinarily
    // carries, which is the row the table prints first.
    return matches[0];
  }

  const loaded = normalise(ammunition.name);
  return (
    matches.find((p) => normalise(p.ammunition ?? "") === loaded) ??
    // "War Arrow" in the ranges table against "War Arrows" in the weapon list.
    matches.find((p) => {
      const printed = normalise(p.ammunition ?? "");
      return printed && (loaded.startsWith(printed) || printed.startsWith(loaded));
    }) ??
    matches[0]
  );
}

/* -------------------------------------------- */

/**
 * What a character has to load a given launcher with.
 *
 * @param {Actor} actor
 * @param {Item} launcher
 * @returns {Item[]}
 */
export function availableAmmunition(actor, launcher) {
  const kind = CNS5.ammunitionKindOf(launcher.name);
  if (!kind) return [];

  // Ammunition is its own kind of item now, so a bow can no longer be loaded
  // with a sword by accident, and an arrow no longer sits in the weapons list
  // waiting to be attacked with.
  return actor.items.filter(
    (i) => i.type === "ammunition" && i.system.kind === kind && i.system.quantity > 0
  );
}

/* -------------------------------------------- */

/**
 * Work out a shot at a given range.
 *
 * @param {object} options
 * @param {object} options.profile   the launcher and ammunition pairing
 * @param {string} options.band      one of CNS5.rangeBands
 * @param {number} options.strength  the shooter's Strength
 * @param {string} options.ammunition  what is loaded, for the strength table
 * @returns {object}
 */
export function resolveShot({
  profile,
  band,
  strength,
  ammunition,
  ammunitionCrit = 0,
  strengthModifiers = null
}) {
  // The table is passed in rather than read from module state. Reading it from
  // whatever a previous call happened to have loaded meant the function was
  // silently wrong anywhere the load had not run, and gave a strong archer no
  // bonus at all.
  const table = strengthModifiers ?? profiles?.strengthModifiers ?? [];
  const row = CNS5.rangedStrengthRow(ammunition ?? profile.ammunition ?? profile.weapon);
  const strong = (Number(strength) || 0) >= CNS5.rangedStrengthMinimum;

  const strengthCrit = strong
    ? table.find((s) => s.ammunition === row)?.modifiers?.[band] ?? 0
    : 0;

  const rangeCrit = profile.critModifiers[band] ?? 0;
  const distance = profile.ranges[band] ?? 0;
  const extra = strong ? CNS5.rangedStrengthBonus(strength, band) : 0;

  return {
    band,
    distance,
    extraDistance: extra,
    reach: distance + extra,
    rangeCrit,
    strengthCrit,
    ammunitionCrit,
    strengthRow: row,
    // Three modifiers meet on the same die: what the missile is made for, how
    // far it has flown, and how hard it was loosed. That is what makes a strong
    // archer with war arrows so much better than a weak one with hunting ones.
    critMod: rangeCrit + strengthCrit + ammunitionCrit,
    baseDamage: profile.baseDamage
  };
}
