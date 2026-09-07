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
const SOURCE = path.join(ROOT, "data", "skills.json");
const STAGING = path.join(ROOT, "build", "packs", "skills");
const OUTPUT = path.join(ROOT, "packs", "skills");

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
 * Convert one extracted row into a skill Item document.
 * @param {object} row
 * @returns {object}
 */
function toDocument(row) {
  const _id = stableId(`cns5.skill.${row.name}`);

  return {
    _id,
    _key: `!items!${_id}`,
    name: row.name,
    type: "skill",
    img: "icons/svg/book.svg",
    system: {
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
    },
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {}
  };
}

/* -------------------------------------------- */

const raw = JSON.parse(await readFile(SOURCE, "utf8"));
const documents = raw.skills.map(toDocument);

const ids = new Set(documents.map((d) => d._id));
if (ids.size !== documents.length) {
  throw new Error("Duplicate document ids — two skills hashed to the same value.");
}

// compilePack reads a directory of JSON files, so stage them first.
await rm(STAGING, { recursive: true, force: true });
const { mkdir, writeFile } = await import("node:fs/promises");
await mkdir(STAGING, { recursive: true });

for (const doc of documents) {
  const slug = doc.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  await writeFile(
    path.join(STAGING, `${slug}_${doc._id}.json`),
    `${JSON.stringify(doc, null, 2)}\n`,
    "utf8"
  );
}

await rm(OUTPUT, { recursive: true, force: true });
await compilePack(STAGING, OUTPUT, { log: false, recursive: false });

console.log(`Built ${documents.length} skills into packs/skills`);
