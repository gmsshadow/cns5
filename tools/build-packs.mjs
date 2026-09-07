/**
 * Build the skills compendium from data/skills.json.
 *
 *   npm install
 *   npm run build:packs
 *
 * The JSON file is the single source of truth. It is produced by
 * tools/extract-skills.py from the skills list on pp.147-148 of the core rules,
 * and holds mechanical data only: name, Difficulty Factor, attribute pair,
 * rulebook group and page reference. No description text is reproduced, so the
 * built pack can live in a public repository.
 *
 * Document ids are derived from the skill name rather than randomly generated,
 * so rebuilding produces stable ids and a world's existing references survive.
 */

import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { compilePack } from "@foundryvtt/foundryvtt-cli";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");
const STAGING = path.join(ROOT, "build", "packs");
const OUTPUT = path.join(ROOT, "packs");

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * A stable 16-character document id derived from a string.
 * @param {string} value
 * @returns {string}
 */
function stableId(value) {
  const digest = createHash("sha256").update(value).digest();
  let id = "";
  for (let i = 0; i < 16; i++) id += ID_ALPHABET[digest[i] % ID_ALPHABET.length];
  return id;
}

/**
 * Wrap system data in the document envelope every pack entry needs.
 * @param {string} type
 * @param {string} name
 * @param {string} img
 * @param {object} system
 * @returns {object}
 */
function document(type, name, img, system) {
  const _id = stableId(`cns5.${type}.${name}`);
  return {
    _id,
    _key: `!items!${_id}`,
    name,
    type,
    img,
    system,
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {}
  };
}

/**
 * Convert one extracted row into a skill Item document.
 * @param {object} row
 * @returns {object}
 */
function toSkill(row) {
  return document("skill", row.name, "icons/svg/book.svg", {
      df: row.df,
      attributes: row.attributes,
      kind: row.kind,
      group: row.category ?? "",
      // A compendium entry carries no standing for any particular character.
      // Secondary is the neutral choice: no PSF adjustment either way, so a
      // dragged skill reads correctly until the player assigns it.
      category: "secondary",
      known: true,
      level: 0,
      mastered: false,
      sunsign: false,
      trainingRequired: false,
      otherMod: 0,
      attributeNote: row.attributeNote ?? "",
      resistedBy: "",
      reference: row.reference ? `p${row.reference}` : "",
    description: ""
  });
}

/* -------------------------------------------- */

/**
 * Convert one extracted weapon row into a weapon Item document.
 *
 * Cost is recorded in pennies, which is how the weapon tables print it. A few
 * entries print "Make" instead of a price — improvised arms a character shapes
 * rather than buys — and those keep a cost of zero with the note in the
 * description slot's reference line.
 *
 * @param {object} row
 * @returns {object}
 */
function toWeapon(row, name = row.name) {
  const blank = { short: 0, medium: 0, long: 0, extreme: 0, max: 0 };

  return document("weapon", name, "icons/svg/sword.svg", {
    role: row.role,
    weightClass: row.weightClass,
    damageType: row.damageType,
    baseDamage: row.baseDamage ?? 0,
    damageBonus: row.damageBonus ?? 0,
    critDieModifier: row.critDieModifier ?? 0,
    apCost: 0,
    bash: row.bash ?? 0,
    length: row.length ?? "",
    group: row.group ?? "",
    dates: row.dates ?? "",
    productionDays: row.productionDays ?? null,
    skill: "",
    missile: Boolean(row.missile),
    ranges: { ...blank, ...(row.ranges ?? {}) },
    rangeModifiers: { ...blank, ...(row.rangeModifiers ?? {}) },
    quantity: 1,
    weight: row.weight ?? 0,
    cost: row.cost ?? 0,
    location: "",
    carried: true,
    equipped: false,
    reference: `p${row.page}${row.costNote ? ` — cost: ${row.costNote}` : ""}`,
    description: ""
  });
}

/* -------------------------------------------- */

/**
 * Convert one extracted armour row into an armour Item document.
 * @param {object} row
 * @returns {object}
 */
function toArmour(row, name = row.name) {
  return document("armour", name, "icons/svg/shield.svg", {
    location: row.location,
    weightClass: row.weightClass,
    absorption: row.absorption,
    fpToWear: 0,
    damageTaken: 0,
    quantity: 1,
    weight: 0,
    cost: 0,
    carried: true,
    equipped: false,
    reference: `p${row.page}`,
    description: ""
  });
}

/* -------------------------------------------- */

const { mkdir, writeFile } = await import("node:fs/promises");

/**
 * Stage a set of documents as JSON files and compile them into a pack.
 * @param {string} name
 * @param {Array<object>} documents
 */
async function build(name, documents) {
  const ids = new Set(documents.map((d) => d._id));
  if (ids.size !== documents.length) {
    throw new Error(`Duplicate document ids in ${name} — two entries hashed alike.`);
  }

  const staging = path.join(STAGING, name);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });

  for (const doc of documents) {
    const slug = doc.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    await writeFile(
      path.join(staging, `${slug}_${doc._id}.json`),
      `${JSON.stringify(doc, null, 2)}\n`,
      "utf8"
    );
  }

  const output = path.join(OUTPUT, name);
  await rm(output, { recursive: true, force: true });
  await compilePack(staging, output, { log: false, recursive: false });

  console.log(`Built ${documents.length} entries into packs/${name}`);
}

const skills = JSON.parse(await readFile(path.join(DATA, "skills.json"), "utf8"));
const gear = JSON.parse(await readFile(path.join(DATA, "gear.json"), "utf8"));

/**
 * Three weapons are listed twice, once for one-handed use and once for two —
 * a Greatsword, a Dwarven Hammer and an Infantry Spear each hit harder in two
 * hands. They are genuinely different entries, so the grip goes in the name to
 * keep them apart in the compendium.
 *
 * @param {Array<object>} rows
 * @returns {Array<object>}
 */
function disambiguate(rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.name] = (acc[row.name] ?? 0) + 1;
    return acc;
  }, {});

  return rows.map((row) => {
    if (counts[row.name] === 1) return toWeapon(row);
    const grip = ["2H", "2HS"].includes(row.typeCode) ? "two-handed" : "one-handed";
    return toWeapon(row, `${row.name} (${grip})`);
  });
}

await build("skills", skills.skills.map(toSkill));
await build("weapons", disambiguate(gear.weapons));
/**
 * The absorption table lists Flesh twice, once under body armour and once under
 * head armour, since an unhelmeted head absorbs as little as a bare chest. The
 * location goes in the name to keep the two entries apart.
 *
 * @param {Array<object>} rows
 * @returns {Array<object>}
 */
function disambiguateArmour(rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.name] = (acc[row.name] ?? 0) + 1;
    return acc;
  }, {});

  return rows.map((row) =>
    counts[row.name] === 1 ? toArmour(row) : toArmour(row, `${row.name} (${row.location})`)
  );
}

await build("armour", disambiguateArmour(gear.armour));
