# Chivalry & Sorcery 5th Edition for Foundry VTT

An unofficial system implementation targeting Foundry VTT v14.

Chivalry & Sorcery and C&S are registered trademarks of Britannia Game Designs Ltd.
This system ships no rules text, tables, or artwork from the published book.

## Build state

Phase 4 of 5: the combat, chattel, magick and faith tabs.

| Phase | Scope | State |
| --- | --- | --- |
| 1 | System skeleton, data models, attributes and derived stats | Done |
| 2 | Skill item and the TSC%/Crit Die engine | Done |
| 3 | Skill compendium generated from the rulebook tables | Done |
| 4 | Remaining tabs: combat, chattel, magick, faith | Done |
| 5 | Character creation wizard following the 19-step worksheet | Next |

## What phase 1 gives you

- Two actor types, `character` and `npc`, both on `TypeDataModel` schemas.
- The twelve attributes, with Agility, Ferocity and Charisma derived from the
  averages of their three contributors plus an innate aptitude modifier.
- Attribute Bonus (PSF%) and Attribute Roll (AR%) computed from the rulebook
  tables for every attribute.
- Body, Fatigue, Lifting and Carrying Capacity, Absolute Strength Rating with
  its light and medium damage bonuses, Jump, and Base Action Points.
- Body and Fatigue recovery rates, and the negative Body threshold at which
  death occurs.
- A clickable Attribute Roll: Percentile Pair against AR%, Crit Die alongside,
  resolved against the general critical outcome table and posted to chat.
- A six-tab sheet matching the six pages of the printed character sheet. The
  four unbuilt tabs render a note naming what will live there.

## What phase 2 adds

- A `skill` item covering both skills and competencies, with Difficulty Factor,
  attribute pair, category, level, Mastery, Sunsign and [TR] training flags.
- Full PSF% assembly: attribute bonuses, +3% per level, +10% vocational, +10%
  Mastery, +10% Sunsign, -10% Tertiary, plus any other modifier.
- The Min%/Max% clamp, converting surplus above Max% and shortfall below Min%
  into Crit Die modifiers at one per 20% or part thereof.
- The unskilled attempt penalty: a failed unskilled Crit Die is worsened by 2.
- A Skills & Experience tab listing skills by category with the printed sheet's
  columns, inline level editing, and one-click rolling.
- A modifier prompt before each roll, skipped by holding shift.
- A chat card with a collapsible breakdown showing how the target was assembled
  and where any Crit Die modifier came from.
- `Add core skills` seeds the nine skills every character has, so the engine is
  usable before the generated compendium arrives.

## Installing for development

Symlink or copy this directory into `<FoundryUserData>/Data/systems/cns5/`.
The folder must contain `system.json` at its root.

Foundry v14 requires Node.js 24 and cannot upgrade a v13 install in place. Use a
separate installation and user data directory while developing.

## Design notes

**Derived attribute rounding.** The rules give Agility, Ferocity and Charisma as
"the average of" three attributes without saying how to round, and every worked
example in the book divides evenly. A world setting picks between rounding down
(the default, and the stricter reading) and rounding to nearest.

**Base Action Points.** Page 113 says fractions round down, but the worked
example for Eleanor rounds 16.5 to 16 while describing it as rounding up. The
worksheet also says round down, so that is what this implements; the two agree
on the result either way.

**Attribute Rolls versus skill checks.** `CnS5Actor##resolve` is deliberately
minimal. The skill check in phase 2 is the same shape with the Difficulty
Factor's BCS%, the Personal Skill Factor, and the Min%/Max% clamp layered on
top. The clamp converts overflow into Crit Die modifiers at one per 20% or part
thereof, which is why `#resolve` already takes a `critMod` it does not yet use
from anywhere but its own signature.

## What phase 3 adds

- **248 skills and competencies** across 20 rulebook groups, extracted from the
  skills list on pp.147-148, shipped as a compendium named `C&S Skills`.
- Drag a skill from the compendium onto a character to add it. Dropping one the
  character already has is refused rather than silently duplicated.
- A `group` field on the skill item carrying the rulebook's own grouping
  (Agricultural, Combat, Thievish and so on). This is a separate axis from
  `category`, which is the skill's mechanical standing for that character. The
  creation wizard will read `group` for the Sunsign favoured categories.
- An `attributeNote` field preserving what the list prints where there is no
  attribute pair: `N/A` for the two Alertness skills, `Various` for Druidic
  Priest Mode.

### Rebuilding the compendium

```
npm install
npm run extract:skills    # regenerate data/skills.json from the PDF
npm run build:packs       # compile data/skills.json into packs/skills
```

`data/skills.json` is the single source of truth. `tools/extract-skills.py`
needs `pdfplumber` and a copy of the core rules PDF; `tools/build-packs.mjs`
needs the Foundry CLI, pulled in by `npm install`.

Document ids are derived from a hash of the skill name, so rebuilding produces
identical ids and existing world references survive.

**What is and is not shipped.** The compendium carries mechanical data only:
name, Difficulty Factor, attribute pair, rulebook group and page reference.
No description text is reproduced — the `description` field on every compendium
entry is empty, and the page reference points the reader at the book.

## What phase 4 adds

All six tabs are now built. Six new item types back them.

**Combat.** Weapons and armour on the Core & Combat tab. A weapon holds no
success chance of its own: it names a combat skill and reads TSC% from it, so
raising Slashing Swords by a level improves every slashing sword the character
owns without touching any of them. Damage is base plus Strength bonus plus the
Attacker's Bonus for the wielder's level, with the adjusted Crit Die added on a
hit. Armour records absorption per damage type as the table prints it; worn
protection and shield protection are totalled separately, because a shield only
absorbs when its bearer wins an active defence.

**Personal Chattel.** Coin in pounds, shillings, pence and farthings, and a
live encumbrance readout. Anything carried counts against Carrying Capacity;
going over costs a Fatigue Point per hour for every 20% over, and shortens the
character's jump. Weapons and armour appear here as well as on the combat tab,
because leaving a suit of maille out of the load total would make the figure
meaningless.

**Magick Grimoire.** Personal Magick Factor derives from the PSF% in the
character's Mode of Magick plus an aspect bonus that runs opposite ways for the
two traditions: a mage benefits from being Well or Poorly Aspected, a
priest-mage from being Neutral. Magick Level follows from PMF. Each spell shows
its targeting chance at short, long and maximum range, and each is clickable.

**Faith.** Personal Faith Factor derives as half the PSF% in Faith plus base
Spirit. Religions are items, so a character can hold more than one with its own
standing. Acts of Faith are gated on PFF and roll against a flat success chance
rather than a Difficulty Factor, so there is no band to clamp against.

**Background & Social.** Character type, period, birth omens, nationality, star
sign, liege and Influence Factor, plus biography and family notes.

### Not yet included

Weapon, armour and equipment catalogues are not shipped. The item types and the
derivations are complete, but the tables on pp.256-263 have not been extracted
the way the skills list was. That is the natural next content pass, and it uses
the same tooling.

## Errata found while implementing

The rulebook contradicts itself in three places. Where it does, the tables are
treated as authoritative over the worked examples and the character sheet.

- **p34, Stephen's carpentry.** The text gives the sum as 30% + 17% - 25% and
  the total as 12%. The sum is right; the total should be 22%.
- **p38, Thomas's brewing.** Brewing is introduced as a DF 3 skill, then the
  example applies the DF 4 minimum of 4%. The DF 3 minimum is 5%. The Crit Die
  modifier works out the same either way, so nothing downstream changes.
- **Character sheet, p597.** The two Alertness skills are printed with an
  experience cost of 900 at DF 7, where the Difficulty Factor table gives 1,000.
  The Magick Grimoire page prints Transcendental Mode as 5 [500] where DF 5 is
  700.
- **p147, skills list.** The Athletic Skills heading is printed `Atheletic`.
  Normalised in the extractor.
- **p148, skills list.** Ritual Preparations is listed as `Ritual Preperations`;
  the description on p217 spells it correctly. The list is preserved as printed.
- **p148, skills list.** Debate cites p232, which is the first page of The
  Marketplace. Its description ends on p231.
- **p106 against p281, Strength damage bonus.** p106 derives it from the
  Absolute Strength Rating — half, rounded up, for medium and heavier weapons;
  a quarter, rounded down, for light. p281 gives it as the Strength attribute
  divided by 2, or by 4 for light weapons. The two give close but different
  numbers. A world setting picks between them, defaulting to the ASR reading,
  since that is what the rating exists for.

## Verification

Run the tests with `npm test`, or individually. They need no Foundry runtime,
because the config tables, the clamp engine and the skills data are all inert.

Derived stats are checked against Brother Arbutus for Weight Factor, Body,
Fatigue and both recovery rates; Harold for Jump; Eleanor and Henry for Base
Action Points; and attribute bonus and AR% spot values from the Skillskape
chapter.

The resolution engine is checked against Stephen's carpentry, Rolf's climb,
both of Roderick's chirurgery examples including the Crit Die modifiers and
final outcomes, and Thomas's brewing, plus the band edges: exactly at Max% or
Min% gives no modifier, 1% over gives +1, 20% over is still +1, and 21% over
becomes +2.

The skills data was extracted twice by independent means: a positional parse
using word coordinates, which recovers names, groups and column structure, and a
regex pass over the flat text layer, which recovers only the numeric triples.
Both produced 248 entries with identical page and Difficulty Factor pairs.
`test/skills-data.test.mjs` then checks the result structurally — every
Difficulty Factor in the table, every attribute key real, every skill carrying
either two attributes or an explanation for having none.

Phase 4's derivations are checked against the Magick Levels worked example on
p289 including the +7-per-level note above PMF 149, the Attacker's Bonus table
including its banded rows and the 20+ row, the aspect bonus in both traditions,
the encumbrance step at and either side of each 20% boundary, and the currency
ratios.
