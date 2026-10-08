/**
 * Vocations and starting skills (pp.119-146).
 *
 * Pure functions over data/character-vocations.json and data/skills.json, so
 * that the creation wizard and the tests share one reading of the rules.
 *
 * A vocation lists its Primary and Secondary skills as entries: a named skill,
 * a choice from a category ("Any 2 Materia Magicka"), or "Any background
 * skills". Every skill a character has falls into one of three categories for
 * that vocation — primary, secondary or tertiary — and the category decides
 * its bonus and how it is promoted.
 */

import { CNS5 } from "../config.mjs";

/* -------------------------------------------- */
/*  Reading the vocation                        */
/* -------------------------------------------- */

/**
 * A vocation with its shared skills and chosen variant folded in.
 *
 * @param {object} data     data/character-vocations.json
 * @param {string} key
 * @param {string} [variantKey]
 * @returns {object|null}
 */
export function resolveVocation(data, key, variantKey = "") {
  const base = data?.vocations?.find((v) => v.key === key);
  if (!base) return null;
  const variants = base.variants ?? [];
  const variant = variants.find((v) => v.key === variantKey) ?? null;
  const shared = base.shared ? data.shared?.[base.shared] ?? [] : [];

  const primary = [...shared, ...base.primary, ...(variant?.primary ?? [])];
  const secondary = [...base.secondary, ...(variant?.secondary ?? [])];
  const modeEntry = primary.find((e) => e.mode);

  return {
    key: base.key,
    name: base.name,
    group: base.group,
    page: base.page,
    variant: variant?.key ?? "",
    variantName: variant?.name ?? "",
    variants: variants.map((v) => ({ key: v.key, name: v.name })),
    needsVariant: variants.length > 0 && !variant,
    attributes: { ...base.attributes, ...(variant?.attributes ?? {}) },
    primary,
    secondary,
    combat: base.combat ?? null,
    masteryOrder: variant?.mastery?.order ?? base.mastery?.order ?? [],
    masteryShare: base.mastery?.share ?? null,
    minimum: base.minimum ?? [],
    mode: modeEntry?.skill ?? null,
    modeName: modeName(modeEntry, variant),
    modeMastery: base.modeMastery ?? null,
    freeMastery: base.freeMastery ?? null,
    fatherBonus: base.fatherBonus ?? null,
    custom: base.custom ?? null,
    optional: Boolean(base.optional)
  };
}

/**
 * The name a mage's Mode skill goes by on his sheet. The skills list has one
 * Elementalist Magus Mode of Magick for all four elements, but Table - Spell
 * Magick Resistance Modifiers (p295) has a column for each, so an
 * Elementalist's skill carries his element: Air Elementalist Mode of Magick.
 *
 * @param {object|undefined} entry  the vocation's mode entry
 * @param {object|null} variant
 * @returns {string|null}
 */
function modeName(entry, variant) {
  if (!entry?.skill) return null;
  if (entry.skill === "Elementalist Magus Mode of Magick" && variant) {
    return `${variant.name.split(" ")[0]} Elementalist Mode of Magick`;
  }
  return entry.skill;
}

/**
 * Index the skills list by name.
 * @param {Array<object>} skills  data/skills.json's `skills`
 * @returns {Map<string, {name: string, group: string, combatCodes: string[]}>}
 */
export function indexSkills(skills) {
  return new Map(
    skills.map((s) => [s.name, { name: s.name, group: s.category, combatCodes: s.combatCodes ?? [] }])
  );
}

/**
 * Whether a skill answers a table entry.
 *
 * @param {object} entry
 * @param {{name: string, group: string, combatCodes: string[]}} info
 * @param {object} ctx  {filters, background: Set<string>}
 * @returns {boolean}
 */
export function entryMatches(entry, info, ctx) {
  if (!info) return false;
  if (entry.skill) return entry.skill === info.name;
  if (entry.skills) return entry.skills.includes(info.name);
  if (entry.oneOf) return entry.oneOf.includes(info.name);
  if (entry.background) return ctx.background?.has(info.name) ?? false;
  if (entry.missing) return false;
  if (!entry.groups?.includes(info.group)) return false;
  const codes = info.combatCodes ?? [];
  if (entry.codes?.include && !entry.codes.include.some((c) => codes.includes(c))) return false;
  if (entry.codes?.exclude && entry.codes.exclude.some((c) => codes.includes(c))) return false;
  if (entry.filter && !(ctx.filters?.[entry.filter] ?? []).includes(info.name)) return false;
  if (entry.only && !entry.only.includes(info.name)) return false;
  return true;
}

/** Whether an entry names its skills rather than offering a choice. */
const isNamed = (entry) => Boolean(entry.skill || entry.skills || entry.oneOf);

/* -------------------------------------------- */
/*  Classifying a character's skills            */
/* -------------------------------------------- */

/**
 * Sort skills into primary, secondary and tertiary for a vocation.
 *
 * Named entries are matched first, then choices from a category. A choice
 * with a number — "Any 2 Charismatic skills" — takes that many and no more;
 * the skills are taken in the order given, so the caller passes the starting
 * picks first and background skills last. Background skills are Secondary
 * unless the vocation lists them as Primary (p119).
 *
 * @param {object} voc      from resolveVocation
 * @param {string[]} names  every skill the character has, in priority order
 * @param {object} ctx      {index, filters, background: Set<string>, picks: Set<string>}
 * @returns {Map<string, "primary"|"secondary"|"tertiary">}
 */
export function classifySkills(voc, names, ctx) {
  const out = new Map();
  const unique = [...new Set(names)];

  // The Adventurer's ten chosen skills are all Primary; everything else he
  // knows came from his youth (p129).
  if (voc.custom) {
    for (const name of unique) {
      if (ctx.picks?.has(name)) out.set(name, "primary");
      else if (ctx.background?.has(name)) out.set(name, "secondary");
      else out.set(name, "tertiary");
    }
    return out;
  }

  const used = new Map();
  const take = (entries, info) => {
    const hit = entries.find(
      (e) => !isNamed(e) && entryMatches(e, info, ctx) && (e.count == null || (used.get(e) ?? 0) < e.count)
    );
    if (hit) used.set(hit, (used.get(hit) ?? 0) + 1);
    return Boolean(hit);
  };

  for (const name of unique) {
    const info = ctx.index.get(name);
    if (voc.primary.some((e) => isNamed(e) && entryMatches(e, info, ctx))) out.set(name, "primary");
  }
  for (const name of unique) {
    if (out.has(name)) continue;
    if (take(voc.primary, ctx.index.get(name))) out.set(name, "primary");
  }
  for (const name of unique) {
    if (out.has(name)) continue;
    const info = ctx.index.get(name);
    if (voc.secondary.some((e) => isNamed(e) && entryMatches(e, info, ctx))) out.set(name, "secondary");
    else if (take(voc.secondary, info)) out.set(name, "secondary");
    else if (ctx.background?.has(name)) out.set(name, "secondary");
    else out.set(name, "tertiary");
  }
  return out;
}

/**
 * The skills a vocation's entries offer, for a chooser: every skill in the
 * list that answers some entry, with the category it would fall in.
 *
 * @param {object} voc
 * @param {object} ctx  {index, filters, background}
 * @returns {Array<{name: string, group: string, category: string}>}
 */
export function vocationalOptions(voc, ctx) {
  const out = [];
  for (const info of ctx.index.values()) {
    if (voc.custom) {
      out.push({ name: info.name, group: info.group, category: "primary" });
      continue;
    }
    const category = voc.primary.some((e) => entryMatches(e, info, ctx))
      ? "primary"
      : voc.secondary.some((e) => entryMatches(e, info, ctx))
        ? "secondary"
        : null;
    if (category) out.push({ name: info.name, group: info.group, category });
  }
  return out.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
}

/* -------------------------------------------- */
/*  Masteries                                   */
/* -------------------------------------------- */

/**
 * Whether the masteries chosen keep to the vocation's order.
 *
 * The order is a list of steps; each step is a set of requirements the next
 * masteries must meet between them, in any order — a Knight's first two are
 * Animal Riding and Mounted Combat, whichever first (p125).
 *
 * @param {object} voc
 * @param {string[]} masteries  in the order chosen
 * @param {object} ctx
 * @returns {Array<{step: number, text: string}>}  the requirements not met
 */
export function checkMasteryOrder(voc, masteries, ctx) {
  const broken = [];
  let at = 0;
  voc.masteryOrder.forEach((step, i) => {
    const slice = masteries.slice(at, at + step.length);
    at += step.length;
    // Named requirements first, so a choice does not take the skill a name
    // needs. The steps are short enough that a greedy match suffices.
    const left = [...slice];
    const ordered = [...step].sort((a, b) => Number(isNamed(b)) - Number(isNamed(a)));
    for (const req of ordered) {
      const found = left.findIndex((name) => entryMatches(req, ctx.index.get(name), ctx));
      if (found >= 0) left.splice(found, 1);
      else broken.push({ step: i + 1, text: req.text });
    }
  });
  return broken;
}

/**
 * Whether the character learns a skill as mastered without spending a slot
 * on it — a noble Knight's Battlefield Tactics (p125).
 *
 * @param {object} voc
 * @param {{gentle: boolean, attributes: object}} who
 * @returns {string|null}  the skill, or null
 */
export function freeMasteryFor(voc, who) {
  const free = voc.freeMastery;
  if (!free) return null;
  if (free.gentle && !who.gentle) return null;
  const attr = who.attributes ?? {};
  if (free.attributes && Object.entries(free.attributes).some(([k, min]) => (attr[k] ?? 0) < min)) return null;
  if (free.total && free.total.of.reduce((sum, k) => sum + (attr[k] ?? 0), 0) < free.total.min) return null;
  return free.skill;
}

/* -------------------------------------------- */
/*  Putting the starting skills together        */
/* -------------------------------------------- */

/**
 * The starting skills, as they will be written to the character.
 *
 * @param {object} state
 * @param {object} state.voc          from resolveVocation
 * @param {string[]} state.picks      the ten starting skills
 * @param {string[]} state.tertiary   Tertiary skills, at Level 0
 * @param {string[]} state.masteries  the five masteries, in order
 * @param {string[]} state.sunsign    skills chosen for the Sunsign (p53)
 * @param {string[]} state.raises     skills a class raises a level (pp.58, 70)
 * @param {Map<string, number>} state.background  known skills and their levels
 * @param {boolean} state.gentle
 * @param {object} state.attributes
 * @param {object} ctx  {index, filters}
 * @returns {Array<{name: string, category: string, level: number, mastered: boolean,
 *                  masteryFree: boolean, masteryPsf: number, sunsign: boolean, origin: string}>}
 */
export function startingSkills(state, ctx) {
  const { voc } = state;
  const background = state.background ?? new Map();
  const picks = new Set(state.picks);
  const masteries = new Set(state.masteries);
  const sunsign = new Set(state.sunsign ?? []);
  const raises = state.raises ?? [];
  const free = freeMasteryFor(voc, state);

  const names = [
    ...state.picks,
    ...state.masteries,
    ...(state.sunsign ?? []),
    ...state.tertiary,
    ...background.keys(),
    ...raises
  ];
  const categories = classifySkills(voc, names, {
    ...ctx,
    background: new Set(background.keys()),
    picks
  });

  const out = [];
  for (const [name, category] of categories) {
    const known = background.get(name) ?? 0;
    let level = picks.has(name) ? Math.max(1, known) : known;
    let mastered = false;
    let masteryPsf = CNS5.startingMastery.psf;
    const isMode = voc.mode === name && voc.modeMastery;

    if (masteries.has(name)) {
      mastered = true;
      level += isMode ? voc.modeMastery.levels : CNS5.startingMastery.levels;
      if (isMode) masteryPsf = voc.modeMastery.psf;
    }
    // "A character of noble background... will learn Battlefield Tactics at
    // +20 PSF% and need not select it for Mastery" (p125).
    if (free === name) mastered = true;

    // "is regarded as Mastered at +20 PSF% and +2 Levels (This is a free
    // mastery slot)" when vocational, "+10 PSF% and +2 levels" otherwise (p53).
    const isSunsign = sunsign.has(name);
    if (isSunsign) {
      level += CNS5.sunsignLevels;
      if (category === "primary") mastered = true;
    }
    level += raises.filter((r) => r === name).length;

    const origin = picks.has(name) || masteries.has(name) || isSunsign
      ? "chosen"
      : state.tertiary.includes(name)
        ? "chosen"
        : CNS5.coreBackgroundSkills.includes(name)
          ? "core"
          : "background";

    // A mastery that cost no slot: the free one of a noble's training, or a
    // vocational Sunsign skill.
    const masteryFree = mastered && !masteries.has(name) && (free === name || (isSunsign && category === "primary"));

    out.push({ name, category, level, mastered, masteryFree, masteryPsf, sunsign: isSunsign, origin });
  }
  return out;
}

/* -------------------------------------------- */
/*  Checking the choices                        */
/* -------------------------------------------- */

/**
 * Everything about the starting skills that breaks a rule. The rules warn
 * rather than forbid: "the Gamemaster may exclude certain skills" and "may
 * allow more skills in the vocational and secondary skills" (pp.119, 130).
 *
 * @param {object} state  as for startingSkills, with `sign` and `signAspect`
 * @param {object} ctx    {index, filters}
 * @returns {Array<{key: string, data: object}>}  CNS5.Vocation.problem.<key>
 */
export function checkStartingSkills(state, ctx) {
  const { voc } = state;
  const problems = [];
  const add = (key, data = {}) => problems.push({ key, data });
  const rules = CNS5.startingSkills;
  const background = state.background ?? new Map();
  const picks = new Set(state.picks);

  if (voc.needsVariant) add("variant");

  const skills = startingSkills(state, ctx);
  const byName = new Map(skills.map((s) => [s.name, s]));

  // The ten.
  if (state.picks.length !== rules.count) add("count", { count: state.picks.length, want: rules.count });
  if (picks.size !== state.picks.length) add("duplicate");
  const picked = state.picks.map((n) => byName.get(n)).filter(Boolean);
  const primary = picked.filter((s) => s.category === "primary").length;
  const secondary = picked.filter((s) => s.category === "secondary").length;
  if (primary < rules.minimumPrimary) add("fewPrimary", { count: primary, want: rules.minimumPrimary });
  if (secondary > rules.maximumSecondary) add("manySecondary", { count: secondary, want: rules.maximumSecondary });
  for (const s of picked) if (s.category === "tertiary") add("notListed", { name: s.name });

  // "the maximum number of primary combat skills they may begin with at Level
  // 1 at no cost (within the starting 10 skills)" (p119).
  if (voc.combat?.max != null) {
    const combat = picked.filter(
      (s) => s.category === "primary" && ctx.index.get(s.name)?.group === "Combat"
    ).length;
    if (combat > voc.combat.max) add("combatCap", { count: combat, want: voc.combat.max });
  }

  // Tertiary skills, by INT + DIS (p120).
  const attr = state.attributes ?? {};
  const allowance = CNS5.tertiarySkillsFor((attr.int ?? 0) + (attr.dis ?? 0));
  if (state.tertiary.length > allowance) add("manyTertiary", { count: state.tertiary.length, want: allowance });
  for (const name of state.tertiary) {
    if (byName.get(name)?.category !== "tertiary") add("notTertiary", { name });
  }

  // The five masteries.
  const free = freeMasteryFor(voc, state);
  if (state.masteries.length !== rules.masteries) {
    add("masteryCount", { count: state.masteries.length, want: rules.masteries });
  }
  for (const name of state.masteries) {
    const s = byName.get(name);
    if (!picks.has(name) && !background.has(name) && !state.tertiary.includes(name)) {
      add("masteryUnknown", { name });
    }
    else if (s?.category === "tertiary") add("masteryTertiary", { name });
    if (name === free) add("masteryFree", { name });
  }
  for (const broken of checkMasteryOrder(voc, state.masteries, ctx)) add("masteryOrder", broken);
  if (voc.mode && voc.modeMastery?.required && !state.masteries.includes(voc.mode)) {
    add("modeMastery", { name: voc.mode });
  }
  if (voc.custom && state.masteries.filter((n) => picks.has(n)).length < voc.custom.specialities) {
    add("specialities", { want: voc.custom.specialities });
  }
  if (voc.masteryShare) {
    const want = Math.floor(rules.masteries * voc.masteryShare.fraction);
    const count = state.masteries.filter((n) => voc.masteryShare.groups.includes(ctx.index.get(n)?.group)).length;
    if (count < want) add("masteryShare", { count, want, groups: voc.masteryShare.groups.join(", ") });
  }
  for (const min of voc.minimum) {
    const count = skills.filter((s) => min.groups.includes(ctx.index.get(s.name)?.group)).length;
    if (count < min.count) add("minimum", { count, want: min.count, groups: min.groups.join(", ") });
  }

  // The Sunsign's favoured skills (p53).
  if (state.sign) {
    const favoured = CNS5.birthSigns[state.sign]?.categories ?? [];
    const want = CNS5.sunsignSkills[state.signAspect] ?? CNS5.sunsignSkills.neutral;
    const chosen = state.sunsign ?? [];
    if (chosen.length > want) add("sunsignCount", { count: chosen.length, want });
    for (const name of chosen) {
      if (!favoured.includes(ctx.index.get(name)?.group)) add("sunsignGroup", { name });
      if (state.masteries.includes(name) && byName.get(name)?.category === "primary") {
        add("sunsignMastered", { name });
      }
    }
  }

  // A class's raises go to skills already known, one level each (pp.58, 70).
  const raises = state.raises ?? [];
  if (new Set(raises).size !== raises.length) add("raiseTwice");
  for (const name of raises) if (!background.has(name)) add("raiseUnknown", { name });
  if (state.raiseAllowance != null && raises.length > state.raiseAllowance) {
    add("manyRaises", { count: raises.length, want: state.raiseAllowance });
  }

  return problems;
}

/* -------------------------------------------- */
/*  Changing vocation (p130)                    */
/* -------------------------------------------- */

/**
 * What a change of vocation does to the skills a character has.
 *
 * "they will acquire 3 vocational skills at level 1 selected from their new
 * vocation. Any existing skills they have which are from the new vocation,
 * can be promoted from secondary to vocational, gaining +10 PSF%. Any existing
 * skills not from the new vocation, are demoted from vocational to secondary
 * and lose their +10 PSF% bonus. Mastery Bonuses for old skills are not lost"
 * (p130).
 *
 * So a skill becomes Primary if the new vocation lists it as such, and
 * otherwise is Secondary — except a Tertiary skill, which only a promotion
 * moves. Levels and masteries are untouched, save that the three new skills
 * reach Level 1.
 *
 * @param {object} voc   the new vocation, from resolveVocation
 * @param {Array<{name: string, category: string, level: number}>} held
 * @param {string[]} picks  the three new vocational skills
 * @param {object} ctx   {index, filters}
 * @returns {Array<{name: string, from: string|null, to: string, level: number, fromLevel: number}>}
 *   every skill the change touches
 */
export function planVocationChange(voc, held, picks, ctx) {
  const heldBy = new Map(held.map((h) => [h.name, h]));
  const chosen = [...new Set(picks.filter(Boolean))];
  // The three new skills first, so a counted choice ("Any 2 Materia
  // Magicka") is filled by what the character is learning now; then what he
  // already practised as vocational; then everything else.
  const order = [
    ...chosen,
    ...held.filter((h) => h.category === "primary").map((h) => h.name),
    ...held.map((h) => h.name)
  ];
  const categories = classifySkills(voc, order, { ...ctx, background: new Set(), picks: new Set(chosen) });

  const out = [];
  for (const [name, category] of categories) {
    const was = heldBy.get(name);
    const from = was?.category ?? null;
    const to = category === "primary" ? "primary" : from === "tertiary" ? "tertiary" : "secondary";
    const fromLevel = was?.level ?? 0;
    const level = chosen.includes(name) ? Math.max(fromLevel, CNS5.vocationChange.level) : fromLevel;
    if (from !== to || level !== fromLevel || !was) out.push({ name, from, to, level, fromLevel });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * What about a change of vocation breaks the rule.
 *
 * @param {object} voc
 * @param {Array<{name: string, category: string, level: number}>} held
 * @param {string[]} picks
 * @param {object} ctx
 * @returns {Array<{key: string, data: object}>}  CNS5.Vocation.problem.<key>
 */
export function checkVocationChange(voc, held, picks, ctx) {
  const problems = [];
  const chosen = picks.filter(Boolean);
  const want = CNS5.vocationChange.skills;
  if (voc.needsVariant) problems.push({ key: "variant", data: {} });
  if (chosen.length !== want) problems.push({ key: "changeCount", data: { count: chosen.length, want } });
  if (new Set(chosen).size !== chosen.length) problems.push({ key: "duplicate", data: {} });
  const plan = new Map(planVocationChange(voc, held, chosen, ctx).map((p) => [p.name, p]));
  const heldBy = new Map(held.map((h) => [h.name, h]));
  for (const name of chosen) {
    const to = plan.get(name)?.to ?? heldBy.get(name)?.category;
    if (to !== "primary") problems.push({ key: "changeNotPrimary", data: { name } });
    else if ((heldBy.get(name)?.level ?? 0) >= CNS5.vocationChange.level) {
      problems.push({ key: "changeKnown", data: { name } });
    }
  }
  return problems;
}
