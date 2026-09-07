/**
 * Handlebars helpers used by the sheets.
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
}
