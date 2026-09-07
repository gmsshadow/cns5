/**
 * Handlebars helpers used by the sheets.
 *
 * `concat`, `eq` and `not` are core Foundry helpers, but the item sheets depend
 * on them for dynamic partial lookup and disabled states, so they are
 * registered defensively rather than assumed.
 */
export function registerHandlebarsHelpers() {
  /**
   * Render a signed number, so a +0 modifier still reads as a modifier rather
   * than a quantity. Attribute bonuses are shown this way throughout.
   */
  Handlebars.registerHelper("cns5Signed", (value) => {
    const n = Number(value) || 0;
    return n >= 0 ? `+${n}` : `${n}`;
  });

  /** Render a percentage with the leading zero the rulebook uses for 01-09%. */
  Handlebars.registerHelper("cns5Percent", (value) => {
    const n = Math.round(Number(value) || 0);
    return `${n < 10 && n >= 0 ? String(n).padStart(2, "0") : n}%`;
  });

  /** Format a farthing total as pounds, shillings, pence and farthings. */
  Handlebars.registerHelper("cns5Coin", (farthings) => {
    const total = Math.max(0, Math.round(Number(farthings) || 0));
    const pounds = Math.floor(total / 960);
    const shillings = Math.floor((total % 960) / 48);
    const pence = Math.floor((total % 48) / 4);
    const rest = total % 4;

    const parts = [];
    if (pounds) parts.push(`${pounds}£`);
    if (shillings) parts.push(`${shillings}s`);
    if (pence) parts.push(`${pence}d`);
    if (rest || !parts.length) parts.push(`${rest}f`);
    return parts.join(" ");
  });

  const fallbacks = {
    concat: (...args) => args.slice(0, -1).join(""),
    eq: (a, b) => a === b,
    lt: (a, b) => a < b,
    not: (value) => !value
  };

  for (const [name, fn] of Object.entries(fallbacks)) {
    if (!Handlebars.helpers[name]) Handlebars.registerHelper(name, fn);
  }
}
