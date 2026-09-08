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

// The weapon-to-skill correspondence lives in the system's config so that the
// same rule applies at runtime to a weapon that has no skill recorded.
const { CNS5 } = await import(path.join(ROOT, "module", "config.mjs"));
const weaponSkill = (weapon) => CNS5.weaponSkill(weapon);

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
  const skill = weaponSkill({ name: row.name, group: row.group, role: row.role });

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
    skill,
    missile: Boolean(row.missile),
    ranges: { ...blank, ...(row.ranges ?? {}) },
    rangeModifiers: { ...blank, ...(row.rangeModifiers ?? {}) },
    // Ammunition priced by the score starts as a full bundle, since that is
    // how it is bought.
    quantity: row.bundle ?? 1,
    bundle: row.bundle ?? 1,
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
 * How each armour piece maps onto the absorption table's armour types.
 *
 * The two sets of tables name things differently, and no amount of fuzzy
 * matching makes "Reinf. Cuirbolli" and "Reinforced Cuirboll" the same string,
 * so the correspondence is written out. A piece with no entry here shares a
 * name with its type.
 */
const PIECE_TYPES = {
  "Leather/Fur Tunic": "Leather/Fur",
  "Arming Doublet": "Cloth",
  "Cuirbolli Cuirass": "Cuirbolli",
  "Reinf. Cuirbolli": "Reinforced Cuirboll",
  "Maille Cuirass": "Maille",
  "Maille Hauberk": "Maille",
  "Platemail Cuirass": "Platemail",
  "Plate Cuirass": "Fieldplate",
  "Field Plate": "Fieldplate",
  "Scalemail Hauberk": "Scalemail",
  "Late Cav. Plate": "Late Cavalry Plate"
};

/**
 * Two helmets in the detail tables — the Composite Helm and the Great Helm —
 * have no row in the absorption table, and two absorption entries have no
 * detail piece. Rather than invent numbers for either, a piece without a type
 * ships with no absorption and says so in its reference.
 */
function absorptionFor(row, byType) {
  const typeName = PIECE_TYPES[row.name] ?? row.name;
  const type = byType.get(`${typeName}|${row.location}`) ?? byType.get(`${typeName}|body`);
  return { typeName, type };
}

/* -------------------------------------------- */

/**
 * Convert an armour piece into an armour Item document, taking its absorption
 * from the type it is made of.
 *
 * @param {object} row
 * @param {Map<string, object>} byType
 * @param {string} [name]
 * @returns {object}
 */
function toArmourPiece(row, byType, name = row.name) {
  const { typeName, type } = absorptionFor(row, byType);
  const blank = { slash: 0, crush: 0, pierce: 0, missile: 0, energy: 0 };

  const references = [`p${row.page}`];
  if (type) references.push(`absorption p${type.page}`);
  else references.push("no absorption row in the rulebook");
  if (row.costAtLeast) references.push("cost is a minimum");

  return document("armour", name, "icons/svg/shield.svg", {
    location: row.location,
    weightClass: type?.weightClass ?? "light",
    armourType: typeName,
    absorption: type ? type.absorption : blank,
    fpToWear: row.fpToWear,
    weightModifier: row.weightModifier,
    damageTaken: 0,
    quantity: 1,
    weight: row.weight,
    cost: row.cost,
    carried: true,
    equipped: false,
    reference: references.join(" — "),
    description: ""
  });
}

/* -------------------------------------------- */

/**
 * An armour type with no piece in the detail tables — Cloth Headgear and the
 * Scalemail Coif — still ships, so its absorption is available. It carries no
 * weight or cost, because the rulebook gives it none.
 *
 * @param {object} row
 * @returns {object}
 */
function toArmourType(row) {
  return document("armour", row.name, "icons/svg/shield.svg", {
    location: row.location,
    weightClass: row.weightClass,
    armourType: row.name,
    absorption: row.absorption,
    fpToWear: 0,
    weightModifier: 0,
    damageTaken: 0,
    quantity: 1,
    weight: 0,
    cost: 0,
    carried: true,
    equipped: false,
    reference: `p${row.page} — absorption only; the rulebook lists no weight or cost`,
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

/**
 * Convert one Act of Faith row into an item document.
 *
 * The tables give a minimum Personal Faith Factor and who may invoke the Act,
 * and nothing else. Success chance, Fatigue cost and the Action Points to pray
 * are not printed there, so they stay at zero for a GM to fill from the Act's
 * own description.
 *
 * @param {object} row
 * @returns {object}
 */
function toActOfFaith(row) {
  const notes = [];
  if (row.vocations.length) notes.push(row.vocations.join(", "));
  if (row.pffInherited) notes.push("minimum PFF shared with the entry above it");

  return document("actOfFaith", row.name, "icons/svg/holy-shield.svg", {
    religion: "",
    vocations: row.vocations,
    section: row.section ?? "",
    pffMinimum: row.pffMinimum,
    successChance: 0,
    fpCost: 0,
    apToPray: 0,
    notes: notes.join(" — "),
    reference: `p${row.page}`,
    description: ""
  });
}

/* -------------------------------------------- */

/**
 * Convert one spell row into a spell Item document.
 *
 * Magick Resistance and Fatigue are numbers for most spells, but several print
 * "Var" or "Spec" instead — the cost depends on how hard the caster pushes, or
 * on the spell's own rules. Those keep the printed word in a note field and a
 * numeric zero, rather than being given a made-up figure.
 *
 * A variant such as Acrid Smoke inherits its parent's casting time and range,
 * because the table prints only what differs.
 *
 * @param {object} row
 * @param {Map<string, object>} byName
 * @returns {object}
 */
function toSpell(row, byName, name = row.name) {
  const parent = row.parent ? byName.get(row.parent) : null;
  const numeric = (value) => {
    const m = /^(\d+)/.exec(value ?? "");
    return m ? Number(m[1]) : 0;
  };
  const note = (value) => (/^\d+$/.test(value ?? "") ? "" : (value ?? ""));
  const plain = (value) => (value && value !== "-" ? value : "");

  const references = [`p${row.reference}`];
  if (parent) references.push(`variant of ${row.parent}`);

  return document("spell", name, "icons/svg/daze.svg", {
    // Recorded where the group implies one. The seven groups it does not cover
    // fall back at runtime to whatever Mode the caster works in.
    mode: CNS5.spellGroupModes[row.section] ?? "",
    group: row.section ?? "",
    mr: numeric(row.mr ?? parent?.mr),
    mrNote: note(row.mr ?? parent?.mr),
    fpToCast: numeric(row.fatigue),
    fatigueNote: note(row.fatigue),
    apToCast: 0,
    castingTime: plain(row.casting ?? parent?.casting),
    duration: plain(row.duration),
    prerequisite: plain(row.prerequisite ?? parent?.prerequisite),
    ranges: { short: plain(row.range ?? parent?.range), long: "", max: "" },
    otherModifier: 0,
    learnt: true,
    reference: references.join(" — "),
    description: ""
  });
}

/* -------------------------------------------- */

/**
 * Convert a bestiary creature into an NPC actor with its attacks, skills and
 * natural armour as embedded items.
 *
 * A creature's Body, Fatigue and Action Points are stated rather than derived,
 * its attacks carry their own Personal Skill Factor instead of naming a skill,
 * and its three listed skills likewise. Everything the bestiary prints has
 * somewhere to go; nothing is invented to fill a gap.
 *
 * @param {object} row
 * @returns {object}
 */
function toCreature(row) {
  const _id = stableId(`cns5.npc.${row.name}`);
  // Embedded documents need a key naming their parent, or the pack compiler
  // cannot place them: `!actors.items!<actor id>.<item id>`.
  const embedded = (suffix) => {
    const itemId = stableId(`cns5.npc.${row.name}.${suffix}`);
    return { _id: itemId, _key: `!actors.items!${_id}.${itemId}` };
  };

  const items = [
    ...row.attacks.map((attack) => ({
      ...embedded(`attack.${attack.name}`),
      name: attack.name,
      type: "weapon",
      img: "icons/svg/sword.svg",
      system: {
        role: "melee",
        weightClass: attack.weightClass,
        damageType: attack.damageType,
        baseDamage: attack.damage,
        psfOverride: attack.psf,
        skill: "",
        carried: true,
        equipped: true,
        reference: `p${row.page}`
      },
      effects: [],
      folder: null,
      sort: 0,
      ownership: { default: 0 },
      flags: {}
    })),
    ...row.skills.map((skill) => ({
      ...embedded(`skill.${skill.name}`),
      name: skill.name,
      type: "skill",
      img: "icons/svg/book.svg",
      system: {
        df: skill.df,
        attributes: [],
        kind: "skill",
        category: "secondary",
        origin: "core",
        known: true,
        level: 0,
        psfOverride: skill.psf,
        reference: `p${row.page}`
      },
      effects: [],
      folder: null,
      sort: 0,
      ownership: { default: 0 },
      flags: {}
    })),
    {
      ...embedded("armour"),
      name: row.armour.name,
      type: "armour",
      img: "icons/svg/shield.svg",
      system: {
        location: "body",
        weightClass: "light",
        armourType: row.armour.name,
        absorption: {
          slash: row.armour.slash,
          crush: row.armour.crush,
          pierce: row.armour.pierce,
          missile: row.armour.missile,
          energy: row.armour.energy
        },
        carried: true,
        equipped: true,
        reference: `p${row.page}`
      },
      effects: [],
      folder: null,
      sort: 0,
      ownership: { default: 0 },
      flags: {}
    }
  ];

  return {
    _id,
    _key: `!actors!${_id}`,
    name: row.name,
    type: "npc",
    img: "icons/svg/mystery-man.svg",
    system: {
      kind: "creature",
      quality: "average",
      tier: "historical",
      details: {
        descriptor: row.descriptor,
        race: row.race,
        disposition: "",
        honour: row.honour
      },
      vitals: {
        bodyOverride: row.body,
        fatigueOverride: row.fatigue,
        bapOverride: row.bap
      },
      movement: { pace: row.pace, sprint: row.sprint },
      magickResistance: row.magickResistance,
      size: { height: row.height, build: 5, weight: row.weight },
      body: { value: row.body },
      fatigue: { value: row.fatigue },
      biography: ""
    },
    items,
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    prototypeToken: { name: row.name, actorLink: false },
    flags: {}
  };
}

/* -------------------------------------------- */

/**
 * Convert a talent row into an item document.
 * @param {object} row
 * @returns {object}
 */
function toTalent(row) {
  const notes = [];
  if (row.wellAspectedOnly) notes.push("Well Aspected characters only");
  if (row.randomOnly) notes.push("cannot be bought — random roll only");

  return document("talent", row.name, "icons/svg/upgrade.svg", {
    roll: { min: row.roll[0], max: row.roll[1] },
    die: "1d100",
    pcCost: row.pcCost,
    randomOnly: row.randomOnly,
    wellAspectedOnly: row.wellAspectedOnly,
    notes: notes.join("; "),
    reference: `p${row.page}`,
    description: ""
  });
}

/**
 * Convert a flaw, deficiency or phobia row into an item document.
 * @param {object} row
 * @param {string} kind
 * @returns {object}
 */
function toFlaw(row, kind, name = row.name) {
  const notes = [];
  if (row.rollsOnAnotherTable) notes.push("roll again on the table it names");

  return document("flaw", name, "icons/svg/downgrade.svg", {
    kind,
    roll: { min: row.roll[0], max: row.roll[1] },
    die: row.die ?? "1d100",
    pcBonus: row.pcBonus,
    // Every phobia starts minor; the dice may make it worse (p94).
    severity: "minor",
    fear: row.fear ?? "",
    rollsOnAnotherTable: Boolean(row.rollsOnAnotherTable),
    notes: notes.join("; "),
    reference: `p${row.page}`,
    description: ""
  });
}

/* -------------------------------------------- */

const skills = JSON.parse(await readFile(path.join(DATA, "skills.json"), "utf8"));
const traits = JSON.parse(await readFile(path.join(DATA, "traits.json"), "utf8"));
const bestiary = JSON.parse(await readFile(path.join(DATA, "bestiary.json"), "utf8"));
const spellData = JSON.parse(await readFile(path.join(DATA, "spells.json"), "utf8"));
const faith = JSON.parse(await readFile(path.join(DATA, "acts-of-faith.json"), "utf8"));
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
 * Build the armour pack from the pieces, falling back to bare types for the two
 * absorption rows that no piece covers.
 *
 * Flesh is dropped: it is the zero row the absorption table opens each section
 * with, a baseline rather than something anyone owns.
 *
 * @returns {Array<object>}
 */
function buildArmour() {
  const byType = new Map(gear.armour.map((a) => [`${a.name}|${a.location}`, a]));

  const pieces = gear.armourPieces.map((row) => toArmourPiece(row, byType));
  const covered = new Set(
    gear.armourPieces.map((row) => absorptionFor(row, byType).typeName)
  );

  const orphanTypes = gear.armour
    .filter((a) => a.name !== "Flesh" && !covered.has(a.name))
    .map(toArmourType);

  const all = [...pieces, ...orphanTypes];
  const counts = all.reduce((acc, doc) => {
    acc[doc.name] = (acc[doc.name] ?? 0) + 1;
    return acc;
  }, {});

  return all.map((doc) =>
    counts[doc.name] === 1
      ? doc
      : { ...doc, name: `${doc.name} (${doc.system.location})` }
  );
}

await build("armour", buildArmour());
await build("acts-of-faith", faith.acts.map(toActOfFaith));
await build("bestiary", bestiary.creatures.map(toCreature));
await build("talents", traits.talents.map(toTalent));

/* Deficiencies, the small additional table, and the phobias all become flaws;
 * only their kind differs.
 *
 * The 1D10 table prints the same entry twice — "Minor Phobia & roll again for
 * another flaw" at 01-05 for seven points and again at 06 for thirteen. That is
 * as printed, so both ship, told apart by the roll that produces them. */
const flawRows = [
  ...traits.flaws.map((row) => [row, "deficiency"]),
  ...traits.additionalFlaws.map((row) => [row, "deficiency"]),
  ...traits.phobias.map((row) => [row, "phobia"])
];
const flawCounts = flawRows.reduce((acc, [row]) => {
  acc[row.name] = (acc[row.name] ?? 0) + 1;
  return acc;
}, {});

await build(
  "flaws",
  flawRows.map(([row, kind]) => {
    if (flawCounts[row.name] === 1) return toFlaw(row, kind);
    const span = row.roll[0] === row.roll[1] ? `${row.roll[0]}` : `${row.roll[0]}-${row.roll[1]}`;
    return toFlaw(row, kind, `${row.name} (${span})`);
  })
);

/**
 * Three spells are listed twice, under two elemental sections apiece — Mist &
 * Fog and Clouds & Rain belong to both Air and Water, and Detect Illusions to
 * both Divination and Illusions with a different Magick Resistance in each.
 * They are genuinely separate entries, so the section goes in the name.
 */
const spellsByName = new Map(spellData.spells.map((s) => [s.name, s]));
const spellCounts = spellData.spells.reduce((acc, row) => {
  acc[row.name] = (acc[row.name] ?? 0) + 1;
  return acc;
}, {});

// The name has to be settled before the document is built: ids are hashed from
// it, so renaming afterwards would leave the two entries sharing an id.
await build(
  "spells",
  spellData.spells.map((row) =>
    toSpell(
      row,
      spellsByName,
      spellCounts[row.name] === 1 ? row.name : `${row.name} (${row.section})`
    )
  )
);
