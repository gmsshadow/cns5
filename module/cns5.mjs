import { CNS5 } from "./config.mjs";
import { CnS5Actor } from "./documents/actor.mjs";
import { CnS5Item } from "./documents/item.mjs";
import { CnS5Combat, CnS5Combatant } from "./documents/combat.mjs";
import { CnS5Character } from "./data/actor-character.mjs";
import { CnS5NPC } from "./data/actor-npc.mjs";
import { CnS5Skill } from "./data/item-skill.mjs";
import { CnS5Weapon, CnS5Armour } from "./data/item-combat.mjs";
import { CnS5Equipment } from "./data/item-equipment.mjs";
import { CnS5Spell, CnS5ActOfFaith, CnS5Religion } from "./data/item-mystical.mjs";
import { CnS5Talent, CnS5Flaw } from "./data/item-traits.mjs";
import { CnS5Ammunition } from "./data/item-ammunition.mjs";
import { CnS5MagickalItem } from "./data/item-magickal.mjs";
import { CnS5CharacterSheet } from "./sheets/character-sheet.mjs";
import { CnS5SkillSheet } from "./sheets/skill-sheet.mjs";
import { CnS5ItemSheet } from "./sheets/item-sheet.mjs";
import { CnS5NPCSheet } from "./sheets/npc-sheet.mjs";
import { CnS5CreationWizard } from "./apps/creation-wizard.mjs";
import { CnS5QuickRoll, addQuickRollButton } from "./apps/quick-roll.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars.mjs";
import { registerDiceColorsets } from "./helpers/dice.mjs";

/**
 * Bind the Apply button on an attack card.
 *
 * The button carries what each pool loses rather than the raw damage, because
 * the split was worked out against the target's armour and Fatigue at the
 * moment of the blow. Recomputing it on click would use whatever they had
 * become by then.
 */
Hooks.on("renderChatMessageHTML", (message, element) => {
  for (const button of element.querySelectorAll("[data-cns5-apply]")) {
    button.addEventListener("click", async () => {
      const actor = await fromUuid(button.dataset.cns5Apply);
      if (!actor) return;
      if (!actor.isOwner) {
        return ui.notifications.warn(game.i18n.localize("CNS5.Damage.notYours"));
      }

      await actor.applyDamage({
        fatigueLost: Number(button.dataset.fatigue) || 0,
        bodyLost: Number(button.dataset.body) || 0
      });
      button.disabled = true;
      button.textContent = game.i18n.localize("CNS5.Damage.applied");
    });
  }
});

/**
 * Give the Crit Die a colour of its own, where Dice So Nice is installed.
 *
 * This hook never fires without the module, so nothing here needs guarding.
 */
/**
 * A button for a free-form roll, beside the macro bar. Foundry replaces the
 * hotbar element whenever it re-renders, so the button is added each time
 * rather than once.
 */
Hooks.on("renderHotbar", (app, element) => {
  addQuickRollButton(element instanceof HTMLElement ? element : element?.[0]);
});

Hooks.once("diceSoNiceReady", (dice3d) => {
  registerDiceColorsets(dice3d);
});

Hooks.once("init", () => {
  console.log("CnS5 | Initialising Chivalry & Sorcery 5th Edition");

  CONFIG.CNS5 = CNS5;
  // Exposed so a macro or another module can reach them.
  game.cns5 = {
    CreationWizard: CnS5CreationWizard,
    QuickRoll: CnS5QuickRoll,
    quickRoll: (options) => CnS5QuickRoll.prompt(options)
  };
  CONFIG.Actor.documentClass = CnS5Actor;
  CONFIG.Item.documentClass = CnS5Item;
  CONFIG.Combat.documentClass = CnS5Combat;
  CONFIG.Combatant.documentClass = CnS5Combatant;
  CONFIG.Actor.dataModels = {
    character: CnS5Character,
    npc: CnS5NPC
  };
  CONFIG.Item.dataModels = {
    skill: CnS5Skill,
    weapon: CnS5Weapon,
    armour: CnS5Armour,
    equipment: CnS5Equipment,
    spell: CnS5Spell,
    actOfFaith: CnS5ActOfFaith,
    religion: CnS5Religion,
    talent: CnS5Talent,
    flaw: CnS5Flaw,
    ammunition: CnS5Ammunition,
    magickalItem: CnS5MagickalItem
  };

  // Initiative is a d10 added to Base Action Points and modified for armour
  // (p268). Without this Foundry falls back to its own formula, which names
  // fields this system does not have and throws when rolled.
  CONFIG.Combat.initiative = { formula: CNS5.initiativeFormula, decimals: 0 };

  // A key for the free-form roll, for anyone who would rather not reach for
  // the mouse. Unbound by default: a system claiming a key uninvited is a
  // nuisance to anyone who had it bound to something else.
  game.keybindings.register("cns5", "quickRoll", {
    name: "CNS5.Quick.title",
    hint: "CNS5.Quick.tooltip",
    editable: [],
    onDown: () => {
      CnS5QuickRoll.prompt();
      return true;
    }
  });

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

  foundry.documents.collections.Actors.registerSheet("cns5", CnS5NPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "CNS5.Sheet.npc"
  });

  foundry.documents.collections.Items.registerSheet("cns5", CnS5SkillSheet, {
    types: ["skill"],
    makeDefault: true,
    label: "CNS5.Sheet.skill"
  });

  foundry.documents.collections.Items.registerSheet("cns5", CnS5ItemSheet, {
    types: [
      "weapon", "armour", "equipment", "spell", "actOfFaith",
      "religion", "talent", "flaw", "ammunition", "magickalItem"
    ],
    makeDefault: true,
    label: "CNS5.Sheet.item"
  });

  return foundry.applications.handlebars.loadTemplates([
    "systems/cns5/templates/actor/npc-sheet.hbs",
    "systems/cns5/templates/actor/parts/header.hbs",
    "systems/cns5/templates/actor/parts/core-combat.hbs",
    "systems/cns5/templates/actor/parts/skills.hbs",
    "systems/cns5/templates/actor/parts/background.hbs",
    "systems/cns5/templates/actor/parts/chattel.hbs",
    "systems/cns5/templates/actor/parts/magick.hbs",
    "systems/cns5/templates/actor/parts/faith.hbs",
    "systems/cns5/templates/item/skill-sheet.hbs",
    "systems/cns5/templates/item/item-sheet.hbs",
    // Registered as partials so the item sheet can select one by item type.
    "systems/cns5/templates/item/weapon-body.hbs",
    "systems/cns5/templates/item/armour-body.hbs",
    "systems/cns5/templates/item/equipment-body.hbs",
    "systems/cns5/templates/item/spell-body.hbs",
    "systems/cns5/templates/item/act-of-faith-body.hbs",
    "systems/cns5/templates/item/religion-body.hbs",
    "systems/cns5/templates/item/talent-body.hbs",
    "systems/cns5/templates/item/flaw-body.hbs",
    "systems/cns5/templates/item/ammunition-body.hbs",
    "systems/cns5/templates/item/magickal-body.hbs",
    "systems/cns5/templates/wizard/wizard.hbs",
    "systems/cns5/templates/wizard/step-method.hbs",
    "systems/cns5/templates/wizard/step-omens.hbs",
    "systems/cns5/templates/wizard/step-identity.hbs",
    "systems/cns5/templates/wizard/step-background.hbs",
    "systems/cns5/templates/wizard/step-attributes.hbs",
    "systems/cns5/templates/wizard/step-size.hbs",
    "systems/cns5/templates/wizard/step-age.hbs",
    "systems/cns5/templates/wizard/step-review.hbs",
    "systems/cns5/templates/chat/check.hbs",
    "systems/cns5/templates/chat/round.hbs"
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

  // p106 says the Strength damage bonus comes from the Absolute Strength
  // Rating; p281 says it is the Strength attribute divided by 2, or 4 for light
  // weapons. The two give similar numbers but are not the same rule. ASR is the
  // default because that is what the rating exists for.
  game.settings.register("cns5", "strengthDamageSource", {
    name: "CNS5.Settings.strengthDamageSource.name",
    hint: "CNS5.Settings.strengthDamageSource.hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      asr: "CNS5.Settings.strengthDamageSource.asr",
      attribute: "CNS5.Settings.strengthDamageSource.attribute"
    },
    default: "asr",
    requiresReload: true
  });

  // Whether a player's own Crit Die is recoloured is their business, not the
  // world's, so this is a client setting.
  game.settings.register("cns5", "colourCritDie", {
    name: "CNS5.Settings.critDie.name",
    hint: "CNS5.Settings.critDie.hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  // Two optional rules from p281, both of which make wounds more dangerous.
  game.settings.register("cns5", "bruisingRule", {
    name: "CNS5.Settings.bruising.name",
    hint: "CNS5.Settings.bruising.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register("cns5", "explodingCritical", {
    name: "CNS5.Settings.exploding.name",
    hint: "CNS5.Settings.exploding.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // Basic combat folds the defence into the attacker's chance; advanced rolls
  // for it separately and reads the pair (p270).
  game.settings.register("cns5", "defenceMode", {
    name: "CNS5.Settings.defence.name",
    hint: "CNS5.Settings.defence.hint",
    scope: "world",
    config: true,
    type: String,
    choices: CNS5.defenceModes,
    default: "basic"
  });

  // The rules do not say what happens when a character declares an action they
  // cannot pay for. Both readings the designers offered are available.
  game.settings.register("cns5", "overspendRule", {
    name: "CNS5.Settings.overspend.name",
    hint: "CNS5.Settings.overspend.hint",
    scope: "world",
    config: true,
    type: String,
    choices: CNS5.overspendRules,
    default: "disallow"
  });
}
