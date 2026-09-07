# Chivalry & Sorcery 5th Edition for Foundry VTT

An unofficial system implementation targeting Foundry VTT v14, verified
against 14.367.

Chivalry & Sorcery and C&S are registered trademarks of Britannia Game Designs Ltd.
This system ships no rules text, tables, or artwork from the published book.

## Build state

Phase 5 of 5: the creation wizard, the spell compendium, and a cross-check
of every dataset against the published player aids.

| Phase | Scope | State |
| --- | --- | --- |
| 1 | System skeleton, data models, attributes and derived stats | Done |
| 2 | Skill item and the TSC%/Crit Die engine | Done |
| 3 | Skill compendium generated from the rulebook tables | Done |
| 4 | Remaining tabs: combat, chattel, magick, faith | Done |
| 4b | Weapon and armour compendia | Done |
| 4c | Action Points, aimed shots, Acts of Faith | Done |
| 5 | Character creation wizard following the 19-step worksheet | Partly done |
| 5b | Spell compendium | Done |

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
npm run extract:gear      # regenerate data/gear.json from the PDF
npm run extract:faith     # regenerate data/acts-of-faith.json from the PDF
npm run extract:spells    # regenerate data/spells.json from the PDF
npm run build:packs       # compile all four into packs/
```

`data/skills.json` and `data/gear.json` are the single sources of truth. The
extractors need `pdfplumber` and a copy of the core rules PDF;
`tools/build-packs.mjs` needs the Foundry CLI, pulled in by `npm install`.

Three weapons appear twice in the tables, once for one-handed use and once for
two — a Greatsword, a Dwarven Hammer and an Infantry Spear each hit harder in
two hands. The grip goes in the compendium name to keep them apart. Flesh
appears twice in the absorption table, once per section, and takes its location
the same way.

Document ids are derived from a hash of the skill name, so rebuilding produces
identical ids and existing world references survive.

**What is and is not shipped.** The compendium carries mechanical data only:
name, Difficulty Factor, attribute pair, rulebook group and page reference.
No description text is reproduced — the `description` field on every compendium
entry is empty, and the page reference points the reader at the book. The same
holds for the weapon and armour packs.

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

## What phase 4b adds

Two more compendia, built by the same pipeline as the skills pack.

- **C&S Weapons** — 71 entries from the melee tables on pp.255-256 and the
  missile table on p257, with missile ranges and their per-band TSC% modifiers
  joined from p258.
- **C&S Armour** — 32 entries. Armour is modelled as *pieces* rather than
  types: a Maille Coif, a Maille Cuirass and a Maille Hauberk are three items
  that share Maille's absorption and differ in weight, cost and Fatigue to wear.
  Pieces come from the detail tables on pp.261-263 and take their absorption
  from the type table on p260.

Drag either onto a character to add it. Unlike skills, gear stacks: three
daggers is a normal thing to carry, so duplicates are allowed.

A weapon now records a `role`. A melee weapon deals its own damage and takes
the wielder's Strength bonus. A launcher deals none — its Base Damage column
holds a bonus added to whatever it looses. Ammunition carries the damage and
gets no Strength bonus, because the arm does not add to a crossbow bolt the way
it adds to a sword blow. Thrown weapons stay melee and gain ranges, since a
javelin does both.

### Armour weight scales with the wearer

Printed weights assume a wearer of 150 to 174 lbs, and each piece carries a
weight modifier applied in steps from that band (p261). A character's armour is
sized automatically: the sheet and the encumbrance total both use the worn
weight, not the printed one. Sir Miles at 210 lbs carries 48 lbs of maille where
the table prints 36.

Above the band the rule is explicit — add the modifier once for every 25 lbs
over 174, rounded up. Below it the book names only two cases, 100 to 124 lbs
subtracting once and under 100 subtracting twice, and says nothing about 125 to
149. That gap is filled with a single subtraction.

## What phase 4c adds

**Action Points.** Table - Combat Actions (p271) keys the cost of every action
off the character's PSF% in the relevant skill rather than off the weapon —
knowing a weapon well is what makes you quick with it. A weapon's Action Point
cost is now derived: it picks its row from its role, group and weight, reads the
band from the wielder's PSF, and shows the result on the sheet and the chat
card. The row can be chosen by hand and the cost overridden where a house rule
needs it.

**Aimed shots.** The optional rule on p272. Attacking now offers a target area
in the roll prompt, from the chest at no penalty down to the eyes at -60%. The
modifier is reported separately from the situational one in the chat card
breakdown, so it is clear where the penalty came from.

**C&S Acts of Faith.** 47 entries from pp.145-146, each with its minimum
Personal Faith Factor and the vocations that may invoke it. The availability
marks turned out to be Wingdings characters rather than drawn glyphs, so they
read straight out of the text layer — and because the tables print both a tick
and a cross for every vocation on every row, a row that does not carry exactly
six marks was read wrongly. All 47 carry six.

Three entries — Last Rites and the two Anointings — print no minimum of their
own and sit under Extreme Unction's PFF 20. They inherit it and are flagged
`pffInherited` rather than being silently given a number.

Success chance, Fatigue cost and the Action Points to pray are not printed in
these tables, so they ship at zero for a GM to fill in from each Act's own
description.

### Known gaps in the gear data
 The melee and missile tables do not
  print them; they come from the combat chapter's attack rate rules.
- **The Misc. Weapons table on p164 is not extracted.** It uses a horizontal
  header layout rather than the rotated one the other tables share. This is why
  Dart, Hunting Javelin and Thrown Axe appear in the ranges table with no
  weapon entry.
- **Shadow Missiles has no figures.** The spell table on p313 prints its name
  and a page reference and nothing else — no Magick Resistance, Fatigue,
  casting time, range or duration. It ships flagged rather than filled in.
- **Two spell prerequisites name no spell.** Dispel Illusions gives a condition
  where a spell name belongs, and Dispel Phantasmals asks for "Dispel Illusion"
  where the spell is called Dispel Illusions. Player Aid 2 prints both exactly
  the same way, so this is the rulebook's, not a misreading.
- **Player Aid 1 drops a plus sign.** Short Swords is printed as `STR AGL`
  where the book has `STR + AGL`. The book's reading is used.
- **Three spells are listed twice.** Mist & Fog and Clouds & Rain appear under
  both Air and Water, and Detect Illusions under both Divination and Illusions
  with a different Magick Resistance in each. The group goes in the name to keep
  them apart.
- **One Act of Faith has no name.** The last row of the Sacraments table prints
  a minimum of PFF 15 and a full set of marks with no name beside it. It is
  skipped rather than guessed at.
- **The bows and arrows block has no group.** The book prints no heading over
  it, and inventing one would be putting words in the rulebook's mouth.
- **Two helmets have no absorption.** The Composite Helm and the Great Helm
  appear in the detail tables on p261 but have no row in the absorption table on
  p260. They ship with zero absorption and say so in their reference line rather
  than carrying invented numbers.
- **Two armour types have no piece.** Cloth Headgear and the Scalemail Coif have
  absorption but no weight or cost. They ship as absorption-only entries.

## What phase 5 adds

A creation wizard, opened from the button beside the character's name. It
follows the published worksheet and keeps the worksheet's own step numbers in
its headings, so a player working from the printed sheet can see where they
are. Nothing is written to the actor until the last step, so backing up and
changing an early answer cannot leave a half-built character behind.

**Built in:**

- **Step 1** — method, period and type. Design carries a PC Point budget of
  125, 150 or 180; the two rolled methods do not, though the spend is still
  shown.
- **Step 3** — birth omens, with their consequences named: Magick Resistance,
  the aspect bonus to a mage's or priest-mage's PMF, and the Well Aspected
  experience bonus.
- **Step 4** — name, gender, race and nationality.
- **Step 11** — attributes by all three methods. Random rolls 3d10 and drops
  the lowest, Lion Heart rolls 2d10, both adding the type's bonus. Design costs
  a point a level to 15 and two a level after. Innate ability modifiers for the
  three derived attributes roll a magnitude; the sign stays the player's, which
  is why the wizard rolls the size and lets you set the direction.
- **Step 12** — height, build and weight, rolled or defaulted. Build is
  adjusted by Agility and Constitution before it decides weight.
- **Steps 13-17** — shown on the review step, all derived.
- **Step 18** — age and experience, rolled or defaulted, with the Well Aspected
  bonus applied.
- **Step 19** — name, and the core skills seeded on finish: the nine every
  character has, plus Accurate Counting for Intellect 12 or better.

**Not built in.** Steps 2 and 5 to 10 — the horoscope, social class, father's
vocation, sibling rank, family status, the curse, talents and flaws — are
collected as free text. Those steps are driven by roughly forty tables spread
across pp.53-101, none of which have been extracted. A roll button that
produced nothing would be worse than an honest text field, so the wizard says
plainly what it cannot do and writes what you enter to the Background & Social
tab.

Vocational, background and tertiary skill selection also stays on the sheet for
now. The skill limits — ten vocational of which no more than four secondary,
five mastered, tertiary by Intellect plus Discipline — are documented in the
rules but not yet enforced.

## The spell compendium

**C&S Spells — 313 entries** from the consolidated spell tables on pp.309-314,
across twenty groups. Each carries its Magick Resistance cost, Fatigue cost,
casting time, range, duration, prerequisite and description page.

The `mode` field is deliberately left blank. The tables group spells by element
and school — Basic Magick Air, Command Magick, Transmutation Magick — and those
cut across the Mode of Magick skills rather than matching them, so linking a
spell to a caster's Mode is left to the player. The rulebook's own grouping is
kept in `group`.

Several spells print `Var` or `Spec` where a number belongs: the cost depends on
how hard the caster pushes, or on the spell's own rules. Those keep the printed
word in a note field beside a numeric zero, and the item sheet shows the word
rather than the zero.

Four entries are variants that print only what differs from the spell above
them — Acrid Smoke, Sulphurous Fumes, Deadly Vapours and Sulphur & Brimstone all
belong to Create Noxious Fumes. Each ships as a spell in its own right, since
that is how it is cast, inheriting its parent's casting time, range and
prerequisite.

## Cross-checked against the player aids

Player Aids 1, 2 and 3 reprint the skill, spell and weapon tables. Because they
are typeset separately from the book, they make a genuinely independent source,
and every dataset was diffed against them.

- **Skills** — 248 rows in the aid, 248 extracted, no differences.
- **Spells** — 313 in each. All 309 entries whose names could be compared match
  field for field on Magick Resistance, Fatigue, casting time, range, duration
  and prerequisite. The four that could not are names the aid's own font
  encoding mangles.
- **Weapons** — every row in the aid is now present, and the numeric fields
  agree.

The weapon comparison found two entries the extractor had been dropping, both
now fixed:

- **Knights Broadsword** was being read as a weapon type of "M Knights" and a
  name of "Broadsword", because a long name right-aligns into its column and
  began left of the boundary with the type column. The type column only ever
  holds a code of three characters or fewer, so that boundary is now set from
  the code's width rather than from the midpoint. There is no separate
  "Broadsword" in the tables; the entry the extraction used to show under that
  name was this one, misread.
- **War Darts** print a dash where their damage belongs and were being rejected
  for having no figure. Ammunition without its own damage now takes it from the
  ranges table where that table lists it — which it does not for War Darts, so
  this one entry ships with a damage of zero and the test names it.

This is what the aids were worth: the skill and spell extractions came through
untouched, and the weapons had two real faults that no amount of checking the
book against itself had turned up.

## Fixed after first run in Foundry

- **The whole language file failed to load.** `CNS5.Creation.method` held a
  string while `CNS5.Creation.method.random` needed it to be an object. Foundry
  expands dotted keys into a nested tree before use, so the collision aborted
  the load and every label on every sheet fell back to its raw key. The field
  label is now `CNS5.Creation.methodLabel`, and `test/lang.test.mjs` fails the
  build if any key is ever the prefix of another again.
- **Dropping an item added it twice.** ActorSheetV2 already handles document
  drops; the sheet had bound a second handler of its own. That binding is gone.
  The rule that a character cannot hold the same skill twice moved to the Item
  document's `_preCreate`, where it holds however the item arrives — by drag, by
  macro, by import — rather than only through the sheet.
- **The sheet would not scroll.** The window content is now a flex column with
  the active tab as the scrolling region. The `min-height: 0` matters: without
  it a flex child will not shrink below its content, so the tab grew past the
  window instead of scrolling inside it.

- **Compendium weapons could not be rolled.** Every weapon shipped with an
  empty `skill` field, so attacking one reported that it needed a skill named
  `""`. Weapons now resolve their combat skill from their group, with per-weapon
  overrides where a group heading covers more than one skill: a Cavalry Flail
  sits under "Flails, Maces & Hammers" but uses Flails, and a Throwing Knife
  sits under Knives but uses Throwing Knives & Daggers. The mapping lives in the
  system's config, so it also applies at runtime to weapons already dragged onto
  a character before this fix.
- **Two weapon group headings were being lost.** "Flails, Maces & Hammers" is
  wide enough to begin left of the weapon type column and was read as a type
  code rather than a heading, so seven weapons inherited "War Axes" from the
  heading above. Headings are now read from the whole row and recognised by
  being centred over the type and name columns without reaching the dated ones.

- **Item sheet edits were silently discarded.** The item templates opened their
  own `<form>`, but DocumentSheetV2 already renders the application element as
  one. A form nested inside a form is invalid HTML, and ApplicationV2 stops
  collecting the fields, so anything typed on a weapon, spell or skill sheet was
  accepted by the browser and then thrown away on close. The templates are plain
  `div`s now, and `test/lang.test.mjs` fails the build if any template opens a
  form again.
- **Compendium spells could not be cast**, for the same reason weapons could not
  be rolled: every spell shipped with an empty `mode`. Thirteen of the twenty
  spell groups have a Mode of Magick skill of nearly the same name — note the en
  dashes in the four elemental ones, which the spell tables write as spaces — and
  those 279 spells now name it. The other 34 fall back to whatever Mode the
  caster works in, which is the right answer for the Common Method and Common
  Elemental groups and a serviceable one for Healing, the two Eldritch groups,
  Portals to the Shadow World and Shadow Monsters, none of which has a skill
  that plainly corresponds.
- **Acts of Faith rolled at 1%.** The tables print no success chance, so
  compendium entries ship with none, and rolling clamped to the 1% floor —
  a roll that looked as though it worked and always failed. Attempting an Act
  with no chance set now says so instead.

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
- **p271, Action Point bands.** The fourth band ends at 70% and the fifth begins
  at 75%, leaving 71-74% unstated. Read as the top band starting at 71%, which
  is the only reading that leaves no hole.
- **p271, loading a medium crossbow.** The fourth figure is printed as 12, lower
  than the band above it and out of step with every other row in the table.
  Preserved as printed; the test names it explicitly so it is not mistaken for
  a transcription slip.
- **pp.261-263, Fatigue cost to wear.** The column is printed as a negative for
  heavier armour but the Cuirbolli Cuirass carries a bare `1`. Every value is a
  cost either way, so the magnitude is stored and the sign discarded.
- **p261, armour weight below the reference band.** The rule covers 100-124 lbs
  and under 100 lbs but leaves 125-149 unstated. See above.
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

The gear data was cross-checked against the flat text layer the same way: every
weapon name and its printed damage code appear on its cited page, and every
armour entry's five absorption values appear consecutively on one line of p260.
`test/gear-data.test.mjs` then checks the result structurally — every weight
class known to the Attacker's Bonus table, every damage type matching an armour
absorption column, launchers dealing no damage of their own, and range bands
that never shrink as they lengthen.

The armour weight rule is checked against the Sir Miles example on p261 — both
his maille and his arming doublet — and at every boundary of the reference band.

The spell data was reconciled page by page against an independent pass over the
flat text layer: all eighteen table pages matched exactly.
`test/spells-data.test.mjs` then checks it structurally — every entry in a
group, every page reference inside the magick chapter, every cost either a
number or one of the rulebook's own words, and every variant naming a parent
that exists.

`test/creation.test.mjs` anchors on the four figures the worksheet states
outright — 99, 117 and 153 PC Points for an average character of each type, and
the 163 lb weight of the worked example — then checks the band edges of the
starting age table, the build adjustments, and that experience only rises as
the point cost falls.

`test/combat-tables.test.mjs` checks the Action Point bands at each boundary,
that every row but the medium crossbow gets cheaper as skill rises, that each
weapon shape picks the right row of the table, and that every Act of Faith
carries a complete set of six availability marks.
