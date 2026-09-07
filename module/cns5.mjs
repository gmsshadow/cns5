import { CNS5 } from "./config.mjs";
import { CnS5Actor } from "./documents/actor.mjs";
import { CnS5Character } from "./data/actor-character.mjs";
import { CnS5NPC } from "./data/actor-npc.mjs";
import { CnS5Skill } from "./data/item-skill.mjs";
import { CnS5CharacterSheet } from "./sheets/character-sheet.mjs";
import { CnS5SkillSheet } from "./sheets/skill-sheet.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars.mjs";

Hooks.once("init", () => {
  console.log("CnS5 | Initialising Chivalry & Sorcery 5th Edition");

  CONFIG.CNS5 = CNS5;
  CONFIG.Actor.documentClass = CnS5Actor;
  CONFIG.Actor.dataModels = {
    character: CnS5Character,
    npc: CnS5NPC
  };
  CONFIG.Item.dataModels = {
    skill: CnS5Skill
  };

  registerSettings();
  registerHandlebarsHelpers();

  // AppV1 is scheduled for removal in v16; once it goes, the core sheets will no
  // longer be registered and there will be nothing to unregister.
  const coreActorSheet = foundry.appv1?.sheets?.ActorSheet;
  if (coreActorSheet) {
    foundry.documents.collections.Actors.unregisterSheet("core", coreActorSheet);
  }
  const coreItemSheet = foundry.appv1?.sheets?.ItemSheet;
  if (coreItemSheet) {
    foundry.documents.collections.Items.unregisterSheet("core", coreItemSheet);
  }

  foundry.documents.collections.Actors.registerSheet("cns5", CnS5CharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "CNS5.Sheet.character"
  });

  foundry.documents.collections.Items.registerSheet("cns5", CnS5SkillSheet, {
    types: ["skill"],
    makeDefault: true,
    label: "CNS5.Sheet.skill"
  });

  return foundry.applications.handlebars.loadTemplates([
    "systems/cns5/templates/actor/parts/header.hbs",
    "systems/cns5/templates/actor/parts/core-combat.hbs",
    "systems/cns5/templates/actor/parts/skills.hbs",
    "systems/cns5/templates/actor/parts/stub.hbs",
    "systems/cns5/templates/item/skill-sheet.hbs",
    "systems/cns5/templates/chat/check.hbs"
  ]);
});

/* -------------------------------------------- */

function registerSettings() {
  // The rules give the derived attributes as "the average of" three others
  // without stating how to round. Every published example works out even, so
  // the ambiguity never surfaces in the book. Rounding down is the stricter
  // reading and the default; groups that prefer nearest can switch.
  game.settings.register("cns5", "attributeRounding", {
    name: "CNS5.Settings.attributeRounding.name",
    hint: "CNS5.Settings.attributeRounding.hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      down: "CNS5.Settings.attributeRounding.down",
      nearest: "CNS5.Settings.attributeRounding.nearest"
    },
    default: "down",
    requiresReload: true
  });
}
