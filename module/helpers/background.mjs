/**
 * Reading the skills a father's vocation gives (pp.66-76).
 *
 * "Before skills and skill levels are selected, the character begins with Level
 * 0 in those skills listed for his father's vocation" (p119). Each row of the
 * tables lists them as the book prints them:
 *
 *     Vegetable Crops, 1 Agricultural Skill +1 Skill
 *     Masonry (Thatching for thatchers) + Lifting (level 2)
 *     Mariner, Small Boats, Knife Fighting + Fishing or 1 Sea Skill
 *
 * Named skills, choices ("1 Agricultural Skill", "+1 Skill" — "appropriate
 * skill of the PC's choice"), alternatives ("Cattle or Dairy Herding"), and now
 * and then a level. This reads that into what can be granted outright and what
 * must be left to the player.
 *
 * The tables name many skills more briefly than the skill chapter does, or by
 * another name altogether, so each is looked up through a table of aliases
 * first. A handful name skills the skill chapter does not have at all; those
 * are reported, not invented.
 */

/**
 * The vocation tables' names for skills, as the skill chapter names them.
 * A value that is an array means the phrase is two skills run together.
 */
export const SKILL_ALIASES = {
  "knife fighting": "Knife & Dagger Fighting",
  "mace combat": "Maces, Hammers & Clubs",
  "axe combat": "Axes",
  "axes": "Axes",
  "javelin": "Hurling Javelins",
  "throw javelin": "Hurling Javelins",
  "riding": "Animal Riding Horse / Pony / Mule",
  "masonry": "Masonry & Stone Cutting",
  "architecture": "Architecture & Engineering",
  "marine architecture": "Shipbuilder Maritime Architecture",
  "ship‘s carpentry": "Ships Carpenter",
  "ship's carpentry": "Ships Carpenter",
  "ship’s carpentry": "Ships Carpenter",
  "small boats": "Sailing Small Boats",
  "piloting": "Piloting & Navigation",
  "sail making & rigging": "Sailmaking & Rigging",
  "sail & cordage maker": "Cord & Rope Making",
  "sewing": "Sewing, Embroidery & Knitting",
  "knitting & embroidering": "Sewing, Embroidery & Knitting",
  "sewing, knitting & embroidering": "Sewing, Embroidery & Knitting",
  "leather-working": "Leatherworking & Tanning",
  "tanning": "Leatherworking & Tanning",
  "smelting": "Smelting & Casting",
  "engraving": "Seal Making & Engraving",
  "gold/silversmithing": "Gold & Silversmithing",
  "weaponsmith": "Weaponsmithing & Armoury",
  "weaponsmithing": "Weaponsmithing & Armoury",
  "painting": "Painting & Sketching",
  "paper making": "Paper & Ink Making",
  "mining": "Mining & Tunnelling",
  "wine making": "Winemaking",
  "cartwright": "Cartwright & Wheelwright",
  "wheelwright": "Cartwright & Wheelwright",
  "lapidary": "Lapidary (Gemcutting)",
  "sculpture": "Sculpting",
  "glass blowing & glazing": "Glassblowing & Glazing",
  "make drugs": "Administer Poisons & Drugs",
  "poisons": "Administer Poisons & Drugs",
  "cutting purses": "Picking Pockets & Cutting Purses",
  "concealing objects": "Concealing & Finding",
  "skulking": "Skulking in Shadows",
  "stealth": "Stealth of Thieves & Assassins",
  "dancing: folk": "Dancing: Folk Dance",
  "veterinary": "Veterinary Medicine",
  "bowyer & fletcher": "Bowery & Fletching",
  "horn and ivory work": "Bone, Horn & Ivory work",
  "horn & ivory work": "Bone, Horn & Ivory work",
  "bone, horn & ivory work": "Bone, Horn & Ivory work",
  "cattle": "Cattle Herding",
  "cattle herding": "Cattle Herding",
  "dairy herding": "Running a Dairy",
  "writing": "Common Tongue Read / Write",
  "write": "Common Tongue Read / Write",
  "evaluate goods": "Evaluating Goods",
  "con hearing rumours": ["Con", "Hearing Rumours"],
  // The words of Basic Chivalric Training (p77).
  "cavalry lance": "Cavalry Lances",
  "dagger": "Knife & Dagger Fighting",
  "reading": "Common Tongue Read / Write",
  // The outsiders' tables (pp.61-65).
  "ancient language": "Ancient Language - Spoken",
  "herbal lore": "Herbalism",
  "evaluate": "Evaluating Goods"
};

/**
 * Names the tables give that span a comma, which must be kept whole before the
 * list is split on its commas.
 */
const COMMA_NAMES = [
  "Sewing, Knitting & Embroidering",
  "Bone, Horn & Ivory Work",
  "Bone, Horn & Ivory work"
];

/**
 * The words the tables use for a category of skill, as our skill list names
 * the category. "Skill" alone, or "Other Skill", is any skill at all.
 */
export const CHOICE_CATEGORIES = {
  agricultural: "Agricultural",
  animal: "Animal",
  athletic: "Athletic",
  combat: "Combat",
  outdoor: "Outdoor",
  sea: "Seamanship",
  thievery: "Thievish",
  "specialist woodworking": "Craft & Trade",
  "specialised woodworking": "Craft & Trade",
  lore: "Lore",
  magick: "Materia Magicka",
  noble: "Noble",
  "written language": "Language",
  "foreign language": "Language"
};

/**
 * Rows whose skills are "Trade Skills", "Domestic & Service Skills" or "Elite
 * Skills" take them from another table; the row's own link says which.
 */
const DEFERRED = /^(varied )?(trade|domestic & service|elite) skills$/i;

/**
 * Read one row's skills.
 *
 * @param {string} text  as the table prints it
 * @param {(name: string) => string|null} resolve  finds a skill by name in the
 *   skill list, returning its proper name or null
 * @returns {{named: Array<{name: string, level: number}>,
 *            choices: Array<{count: number, category: string|null, options: string[], label: string}>,
 *            missing: string[], deferred: boolean}}
 */
export function parseBackgroundSkills(text, resolve) {
  const out = { named: [], choices: [], missing: [], deferred: false };
  let raw = (text ?? "").trim();
  if (!raw) return out;
  if (DEFERRED.test(raw)) {
    out.deferred = true;
    return out;
  }

  // A level given for a skill — "(Endurance at level 2)", "Lifting (level 2)".
  const levels = new Map();
  raw = raw.replace(/\(([A-Za-z’' ]+?) at level (\d)\)/gi, (_, name, level) => {
    levels.set(name.trim().toLowerCase(), Number(level));
    return "";
  });
  raw = raw.replace(/([A-Za-z’'& ]+?)\s*\(level (\d)\)/gi, (_, name, level) => {
    levels.set(name.trim().toLowerCase(), Number(level));
    return name;
  });
  // Any other parenthesis is a note about the skill, not part of its name.
  raw = raw.replace(/\([^)]*\)/g, "");

  // Keep names that contain a comma whole.
  const kept = [];
  for (const name of COMMA_NAMES) {
    const at = raw.toLowerCase().indexOf(name.toLowerCase());
    if (at >= 0) {
      kept.push(name);
      raw = raw.slice(0, at) + `§${kept.length - 1}§` + raw.slice(at + name.length);
    }
  }
  const restore = (s) => s.replace(/§(\d+)§/g, (_, i) => kept[Number(i)]);

  const find = (phrase) => {
    const clean = phrase.replace(/[:\s]+$/, "").trim();
    const alias = SKILL_ALIASES[clean.toLowerCase()];
    if (Array.isArray(alias)) return alias.map((a) => resolve(a));
    const name = resolve(alias ?? clean);
    return [name];
  };

  const levelOf = (name, phrase) =>
    levels.get(phrase.trim().toLowerCase()) ?? levels.get(name.toLowerCase()) ?? 0;

  const readChoice = (phrase) => {
    // "1 Agricultural Skill", "+2 Outdoor Skills", "Skill", "+3 Other Skills".
    // "Musical Instrument" is a choice among the instruments; "Varies" is the
    // book's own word for a trade it leaves to the table.
    if (/^musical instrument$/i.test(phrase.trim())) {
      return { count: 1, category: "Art & Entertainment", options: [], label: phrase.trim() };
    }
    if (/^varies$/i.test(phrase.trim())) {
      return { count: 1, category: null, options: [], label: phrase.trim() };
    }
    // A footnote's number may be left standing after the word: "1 Skill 1".
    const m = /^\+?\s*(\d+)?\s*([A-Za-z ]*?)\s*Skills?(?:\s*\d)?$/i.exec(phrase.trim());
    if (!m) {
      const lang = /^\+?\s*(\d+)\s+(Written Language|Foreign Language|Lore|Magick Methods?)$/i.exec(phrase.trim());
      if (!lang) return null;
      return {
        count: Number(lang[1]),
        category: CHOICE_CATEGORIES[lang[2].toLowerCase().replace(/ methods?$/, "")] ?? null,
        options: [],
        label: phrase.trim()
      };
    }
    const kind = (m[2] ?? "").trim().toLowerCase();
    const category = kind && kind !== "other" ? CHOICE_CATEGORIES[kind] ?? null : null;
    if (kind && kind !== "other" && !category) return null;
    return { count: Number(m[1] ?? 1), category, options: [], label: phrase.trim() };
  };

  for (const piece of raw.split(/,|\+(?=\s*[A-Za-z\d§])/)) {
    const phrase = restore(piece).trim();
    if (!phrase) continue;

    // "Con + Trade Skills": the trade skills come from the trade rolled.
    if (DEFERRED.test(phrase)) {
      out.deferred = true;
      continue;
    }

    // "Cattle or Dairy Herding", "Fishing or 1 Sea Skill": one of them.
    if (/\bor\b/i.test(phrase)) {
      let parts = phrase.split(/\s+or\s+/i).map((p) => p.trim());
      // "Cattle or Dairy Herding" shares its last word between the two.
      if (parts.length === 2 && !/\s/.test(parts[0]) && /\s/.test(parts[1]) && !/^\d/.test(parts[1])) {
        const shared = parts[1].split(/\s+/).pop();
        if (!find(parts[0])[0]) parts[0] = `${parts[0]} ${shared}`;
      }
      const options = [];
      let category = null;
      for (const part of parts) {
        const choice = readChoice(part);
        if (choice) category = choice.category ?? category;
        else options.push(...find(part).filter(Boolean));
      }
      out.choices.push({ count: 1, category, options, label: phrase });
      continue;
    }

    const choice = readChoice(phrase);
    if (choice) {
      out.choices.push(choice);
      continue;
    }

    const found = find(phrase);
    if (found.every(Boolean)) {
      for (const name of found) out.named.push({ name, level: levelOf(name, phrase) });
    } else {
      out.missing.push(phrase.replace(/[:\s]+$/, ""));
    }
  }

  // A name given twice — "Sewing, Knitting & Embroidering" and "Sewing" are
  // one skill here — is granted once, at the higher level.
  const seen = new Map();
  for (const skill of out.named) {
    const had = seen.get(skill.name);
    if (!had || had.level < skill.level) seen.set(skill.name, skill);
  }
  out.named = [...seen.values()];
  return out;
}

/* -------------------------------------------- */

/**
 * A row of a d100 table, by the roll.
 * @param {Array<{roll: number[]}>} rows
 * @param {number} value
 */
function rowFor(rows, value) {
  return rows.find((r) => value >= r.roll[0] && value <= r.roll[1]) ?? null;
}

/**
 * Follow a row that sends the roller on: to the trades (the group, then the
 * trade), the merchants, the household services or the urban elites.
 *
 * The next table's skills are added to the row's own — "Con + Trade Skills"
 * keeps its Con — and the reader sets the words "Trade Skills" aside. A trade
 * or a merchant's figure modifies the status the row gave; the household's and
 * the elites' replace it. Anyone who trades is given Bargaining and Evaluating
 * Goods (pp.70, 71, 75).
 *
 * @param {object} data    data/vocations.json
 * @param {object} row     the row that links on
 * @param {object} result  what is being built, changed in place
 * @param {() => Promise<number>} roll  a d100, recorded
 */
export async function followVocationLink(data, row, result, roll) {
  const follow = async (rows, page, modifier) => {
    const next = rowFor(rows, await roll());
    if (!next) return;
    result.vocation = `${row.vocation}: ${next.vocation}`;
    result.skills = [row.skills, next.skills].filter(Boolean).join(", ");
    result.pages.push(page);
    if (modifier && Number.isFinite(next.statusModifier) && Number.isFinite(result.status)) {
      result.status += next.statusModifier;
    } else if (!modifier && Number.isFinite(next.status)) {
      result.status = next.status;
    }
    if (next.statusNote) result.statusNote = next.statusNote;
  };

  if (row.link === "trades") {
    const group = rowFor(data.trades.groups, await roll());
    if (group) await follow(group.rows, group.page, true);
    result.grants = data.trades.grants ?? [];
  } else if (row.link === "merchants") {
    await follow(data.merchants.rows, data.merchants.page, true);
    result.grants = data.merchants.grants ?? [];
  } else if (row.link === "domestic") {
    await follow(data.domestic.rows, data.domestic.page, false);
  } else if (row.link === "urbanElites") {
    await follow(data.urbanElites.rows, data.urbanElites.page, false);
  }
}

/**
 * Roll a father's vocation, following the table where it says to go next.
 *
 * The tables are rolled by class and band. Some rows say only "Trade Skills"
 * and send the roller on — to the trades (two rolls: the group, then the
 * trade within it), the merchants, the household services or the urban
 * elites — and there the skills are found. A trade or a merchant's line adds a
 * status modifier to the base the first table gave. Anyone who trades has
 * Bargaining and can Evaluate what he deals in (pp.70, 71, 75).
 *
 * @param {object} data   data/vocations.json
 * @param {string} cls    the social class
 * @param {string} band   where in it
 * @param {() => Promise<number>|number} d100  a roll of the percentile dice
 * @returns {Promise<object|null>} null where the class has no table here
 */
export async function rollFathersVocation(data, cls, band, d100) {
  const table = data.classes?.[cls]?.[band];
  if (!table) return null;

  const rolls = [];
  const roll = async () => {
    const value = await d100();
    rolls.push(value);
    return value;
  };

  const row = rowFor(table.rows, await roll());
  if (!row) return null;

  const result = {
    vocation: row.vocation,
    skills: row.skills,
    status: row.status ?? null,
    statusNote: row.statusNote ?? null,
    grants: [],
    labourer: Boolean(row.labourer),
    link: row.link ?? null,
    pages: [table.page],
    rolls
  };

  await followVocationLink(data, row, result, roll);

  return result;
}

/* -------------------------------------------- */

/**
 * Roll a chivalric father: rank, vocation and holdings (pp.57, 77-81).
 *
 * In the book's own order (p57): the economic band modifies the roll for rank;
 * the period's table of esquires and knights gives the father's vocation and a
 * Base Status; Table - Holdings gives the size of his holding, with a knight's
 * bonus and his rank's; and the fief itself is found on the table for his rank.
 * With no holding at all he is one of the landless fighting men instead.
 *
 * Two readings are taken where the book leaves room:
 *
 *  - The rank's modifier is added to the roll for the fief's type as well as
 *    its size, as the tables' footnotes say, but a knight's own +10 only to the
 *    size: the worked example on p57 rolls a knight's fief type without it.
 *  - "Roll again twice" and the like are rolled without their own rows — "ignoring
 *    all rolls of 91%+" — and a second fief is found a rank lower, at a
 *    cumulative -10.
 *
 * @param {object} data     data/nobility.json
 * @param {object} options  {period, band, scholarly}
 * @param {object} dice     {d100(): number, roll(formula): number}
 * @param {object} config   the CNS5 namespace
 * @returns {Promise<object>}
 */
export async function rollChivalricBackground(data, { period, band, scholarly = false }, dice, config) {
  const rolls = [];
  const d100 = async () => {
    const v = await dice.d100();
    rolls.push(v);
    return v;
  };

  // 1. Rank, modified by wealth.
  const rankRoll = Math.max(1, (await d100()) + (config.chivalricEconomicModifier[band] ?? 0));
  const rank = rowFor(config.chivalricRanks, rankRoll);

  // 2. The father's vocation for the period.
  const table = data.esquires[period] ?? data.esquires.hc;
  const father = rowFor(table, await d100());

  const result = {
    rank: rank.key,
    vocation: father.vocation,
    knight: father.knight,
    status: father.status,
    statusNote: null,
    readingInt: father.readingInt,
    training: scholarly
      ? config.scholarlyTraining
      : father.noCourtlyManners
        ? config.militeTraining
        : config.basicChivalricTraining,
    extraSkills: "",
    holdings: [],
    pages: [77, 78],
    rolls
  };

  // A fief of a given table, found with a modifier.
  const fiefOn = async (tableKey, modifier) => {
    const rows = data.fiefs[tableKey];
    const value = Math.max(1, (await d100()) + modifier);
    return { table: tableKey, ...rowFor(rows, value) };
  };

  // One holding: its kind, and the fief where there is one.
  const holdingOf = async (kind, row, index) => {
    if (kind === "fief") {
      // The chief fief on his own rank's table; each further one a rank lower.
      const at = Math.max(0, config.chivalricRankOrder.indexOf(rank.key) - index);
      const fief = await fiefOn(
        config.chivalricRankOrder[at],
        rank.holdingBonus + index * config.additionalFiefModifier
      );
      return { kind, fief, contribution: fief.statusModifier };
    }
    if (kind === "partFief") {
      const fief = await fiefOn("lesserGentry", config.partFiefModifier + index * config.additionalFiefModifier);
      const share = 40 + (await dice.roll("2d10"));
      return { kind, fief, share, contribution: Math.floor(fief.statusModifier / 2) };
    }
    if (kind === "minimal" || kind === "land") {
      return { kind, acres: await dice.roll(row.acres), contribution: row.statusModifier ?? 0 };
    }
    return { kind: "none", contribution: 0 };
  };

  // 3. The size of the holding.
  const holdingRoll = (await d100()) + father.holdingBonus + rank.holdingBonus;
  const size = rowFor(data.holdings, Math.min(100, holdingRoll));

  if (["two", "three", "d10"].includes(size.kind)) {
    let count = size.kind === "two" ? 2 : size.kind === "three" ? 3 : 0;
    if (size.kind === "d10") {
      // "If 10 is rolled, roll again": the tens add up.
      let die;
      do {
        die = await dice.roll("1d10");
        count += die;
      } while (die === 10 && count < 100);
    }
    for (let i = 0; i < count; i++) {
      // Rolled without the rows that would roll again.
      let row;
      for (let tries = 0; tries < 20; tries++) {
        row = rowFor(data.holdings, Math.min(100, (await d100()) + father.holdingBonus + rank.holdingBonus));
        if (!row || !["two", "three", "d10"].includes(row.kind)) break;
        row = null;
      }
      const fiefs = result.holdings.filter((h) => h.fief).length;
      result.holdings.push(await holdingOf(row?.kind ?? "fief", row, fiefs));
    }
  } else if (size.kind !== "none") {
    result.holdings.push(await holdingOf(size.kind, size, 0));
  }

  // 4. No holding at all: a landless fighting man.
  if (!result.holdings.length || result.holdings.every((h) => h.kind === "none")) {
    const landless = rowFor(data.landless, await d100());
    result.vocation = landless.vocation;
    // His row names Basic Chivalric Training among its skills, or not at all.
    result.skills = landless.skills.replace("Basic Chivalric Training", result.training);
    result.readingInt = landless.readingInt ?? null;
    if (landless.household) {
      result.statusNote = "household";
    } else {
      result.status += landless.statusModifier;
    }
    result.holdings = [];
    result.pages.push(79);
    delete result.training;
    delete result.extraSkills;
    return result;
  }

  // Status: the base, the chief holding's part, and +1 for each two further fiefs.
  const chief = result.holdings.reduce((best, h) => (h.contribution > best.contribution ? h : best));
  const further = result.holdings.filter((h) => h !== chief && h.fief).length;
  result.status += chief.contribution + Math.ceil(further / 2);

  // The fief's table adds combat skills to his training.
  const combat = chief.fief?.combatSkills ?? 0;
  if (combat && !scholarly) result.extraSkills = `${combat} Combat Skill${combat > 1 ? "s" : ""}`;

  for (const h of result.holdings) {
    if (h.fief) {
      result.pages.push({ lesserGentry: 79, lord: 80, titled: 80, royal: 81 }[h.fief.table]);
    }
  }
  result.pages = [...new Set(result.pages)];
  // One line of skills, as the vocation tables write them, for the same reader.
  result.skills = [result.training, result.extraSkills].filter(Boolean).join(", ");
  delete result.training;
  delete result.extraSkills;
  return result;
}

/* -------------------------------------------- */

/**
 * Roll the father's vocation for a Jew or a slave (pp.60-65).
 *
 * A Jew rolls on Table - Jews: first the group — the marginal fringe, poor Jews,
 * the small people of the Jewish quarter, the wealthy, the cultural elites —
 * then the vocation within it. "Indicated status is that within the Jewish
 * community. Within the wider community Social Status is 1/2 of Jewish status
 * (round up)."
 *
 * A slave's standing turns on whose household he serves, so the owner's
 * household and its wealth are rolled first, then the slave's vocation: on the
 * Early Feudal table, or around the Mediterranean on the table of mothers'
 * vocations. "The servant of a noble has +2 Social Status; the servant of a
 * rich townsman has +1." Slaves of the later periods outside the Mediterranean
 * "are treated instead as 'Destitute/Landless' Serfs" (p60), which is said
 * rather than rolled here.
 *
 * @param {object} outsiders  data/outsiders.json
 * @param {object} vocations  data/vocations.json, for the trades and merchants
 * @param {object} options    {kind: "jew"|"slave", period, mediterranean}
 * @param {() => Promise<number>|number} d100
 * @returns {Promise<object|null>} null where there is no table; for a slave
 *   outside the Mediterranean after the Early Feudal, {treatAs: {cls, band}}
 */
export async function rollOutsiderBackground(outsiders, vocations, { kind, period, mediterranean = false }, d100) {
  const rolls = [];
  const roll = async () => {
    const value = await d100();
    rolls.push(value);
    return value;
  };

  if (kind === "jew") {
    const group = rowFor(outsiders.jews.groups, await roll());
    const row = rowFor(group.rows, await roll());
    const result = {
      vocation: row.vocation,
      skills: row.skills,
      status: row.status ?? null,
      statusNote: row.statusNote ?? null,
      group: group.name,
      grants: row.trades ? outsiders.jews.grants : [],
      labourer: false,
      link: row.link ?? null,
      pages: [group.page],
      rolls
    };
    await followVocationLink(vocations, row, result, roll);
    // Standing in the wider community is half that among the Jews.
    result.wider = Number.isFinite(result.status) ? Math.ceil(result.status / 2) : null;
    return result;
  }

  if (kind === "slave") {
    const where = period === "ef" ? "ef" : mediterranean ? "mediterranean" : null;
    if (!where) return { treatAs: { cls: "serf", band: "destitute" } };

    const slaves = outsiders.slaves;
    const household = rowFor(slaves.owners[where], await roll()).household;
    const band = rowFor(slaves.bands[household], await roll()).band;
    const table = slaves[where];
    const row = rowFor(table.rows, await roll());

    let status = row.status ?? null;
    if (row.servant && Number.isFinite(status)) {
      status += slaves.servantStatus[household] ?? slaves.servantStatus[`${household}.${band}`] ?? 0;
    }

    const result = {
      vocation: row.vocation,
      skills: row.skills,
      status,
      statusNote: null,
      owner: { household, band },
      grants: [],
      labourer: Boolean(row.labourer),
      link: row.link ?? null,
      pages: [table.page],
      rolls
    };
    await followVocationLink(vocations, row, result, roll);
    return result;
  }

  return null;
}
