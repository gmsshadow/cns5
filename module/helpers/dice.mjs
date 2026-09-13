import { CNS5 } from "../config.mjs";

/**
 * Colouring the Crit Die, where Dice So Nice is installed.
 *
 * "Use a different coloured dice for the Crit Die" (p36). On a physical table
 * that is a matter of picking up a different die; here the two land together
 * and look identical, which is exactly the confusion the suggestion exists to
 * prevent.
 *
 * Nothing here depends on the module being present. Setting an appearance on a
 * roll is inert without it, and the registration happens on a hook that never
 * fires if it is not installed.
 */

/**
 * Mark a roll as the Crit Die, or as the extra die a critical adds.
 *
 * @param {Roll} roll
 * @param {string} [which]  "crit" or "bonus"
 * @returns {Roll} the same roll, for chaining
 */
export function styleDie(roll, which = "crit") {
  if (!roll) return roll;

  // Each player decides whether their own dice are recoloured, so the setting
  // is read here rather than at registration.
  try {
    if (!game.settings.get("cns5", "colourCritDie")) return roll;
  } catch {
    return roll;
  }

  const colorset = which === "bonus" ? "cns5-crit-bonus" : "cns5-crit";
  for (const die of roll.dice ?? []) {
    die.options.appearance = { colorset };
  }
  return roll;
}

/**
 * Register the system's colour schemes with Dice So Nice.
 *
 * Called from the module's own ready hook, so it does nothing at all when the
 * module is absent.
 *
 * @param {object} dice3d
 */
export function registerDiceColorsets(dice3d) {
  for (const colorset of CNS5.diceColorsets) {
    dice3d.addColorset(
      { ...colorset, description: game.i18n.localize(colorset.description) },
      "default"
    );
  }
}
