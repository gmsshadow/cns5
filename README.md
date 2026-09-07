# Chivalry & Sorcery 5th Edition for Foundry VTT

An unofficial system implementation targeting Foundry VTT v14.

Chivalry & Sorcery and C&S are registered trademarks of Britannia Game Designs Ltd.
This system ships no rules text, tables, or artwork from the published book.

## Build state

Phase 2 of 5: the skill item and the Skillskape resolution engine.

| Phase | Scope | State |
| --- | --- | --- |
| 1 | System skeleton, data models, attributes and derived stats | Done |
| 2 | Skill item and the TSC%/Crit Die engine | Done |
| 3 | Skill compendium generated from the rulebook tables | Next |
| 4 | Remaining tabs: combat, chattel, magick, faith | |
| 5 | Character creation wizard following the 19-step worksheet | |

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

## Verification

Run the tests with `node test/derived-stats.test.mjs` and
`node test/skillskape.test.mjs`. They need no Foundry runtime, because both the
config tables and the clamp engine are pure functions.

Derived stats are checked against Brother Arbutus for Weight Factor, Body,
Fatigue and both recovery rates; Harold for Jump; Eleanor and Henry for Base
Action Points; and attribute bonus and AR% spot values from the Skillskape
chapter.

The resolution engine is checked against Stephen's carpentry, Rolf's climb,
both of Roderick's chirurgery examples including the Crit Die modifiers and
final outcomes, and Thomas's brewing, plus the band edges: exactly at Max% or
Min% gives no modifier, 1% over gives +1, 20% over is still +1, and 21% over
becomes +2.
