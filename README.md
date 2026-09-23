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
  be rolled: every spell shipped with no school named. Thirteen of the twenty
  spell groups have a Method of Magick skill of nearly the same name — note the
  en dashes in the four elemental ones, which the spell tables write as spaces —
  and those 279 spells now name it.
- **A Mode is not a Method.** A Mode of Magick is the tradition a mage was
  trained in — Hex Master, Thaumaturgy, Conjuration. A Method is a school —
  Arcane Magick, Command Magick, Basic Magick – Fire — and the casting roll is
  made against a school. The 34 spells belonging to no school in particular fell
  back to the caster's *Mode*, which fetched the wrong skill with the wrong
  Difficulty Factor and the wrong Personal Skill Factor; and since a target
  resists by that same figure, the wrong save as well.

  Those spells are cast "with whatever Method the caster has", so the caster's
  own skills are consulted instead. One Method is no choice at all and is used
  without asking; several is a choice the rules leave to the caster, and the
  roll asks.

  The stored field on a spell is still called `mode`, but nothing reads it by
  that name any more: `method`, `methodItem`, `resolvedMethod` and
  `methodMissing` stand over it and are what the rest of the system uses. The
  old word survives in exactly two places — the schema that declares the field,
  and the form input that addresses it — and both are commented as deliberate.
  A test reads the source to check each getter still returns the field it
  stands for, and that nothing else reads a spell's school by the wrong name.

  Renaming the field itself remains a schema change with a migration behind it,
  and buys nothing further now that the confusion has been removed from
  everywhere it could do harm.
- **Acts of Faith rolled at 1%.** The tables print no success chance, so
  compendium entries ship with none, and rolling clamped to the 1% floor —
  a roll that looked as though it worked and always failed. Attempting an Act
  with no chance set now says so instead.

- **The sheet was hard to read.** Foundry styles tables with a dark head and
  dark banding of its own, which showed through and left several columns as grey
  on grey. Those backgrounds are now cleared and the banding reapplied in the
  sheet's own colours. The palette was darkened so that every ink clears 4.5:1
  against all three grounds, secondary text was sized up from 11px, and the
  figures a player actually reads mid-roll — attribute rolls, weapon totals,
  armour absorption totals — are now the largest and heaviest thing in their
  table rather than the faintest. `test/styles.test.mjs` holds the contrast
  ratios so a later tweak to a colour cannot quietly undo it.

  Worth noting for anyone editing the stylesheet: the reset clears backgrounds
  only. Resetting colour or border there would out-specify the rules further
  down that set them deliberately, because a two-class selector beats a
  one-class one however far below it appears.
- **The chat card laid itself out sideways.** `.cns5-check` was doing double
  duty as both the chat card and the label around a checkbox. The checkbox rule
  comes later in the file and set `display: flex` with the default row
  direction, so the card's own column direction was overridden and every part of
  it — heading, dice, verdict — was squeezed into a narrow column of its own.
  The checkbox is `.cns5-checkbox` now, and `test/styles.test.mjs` checks that
  every class a template uses is actually styled.
- **The tabs stayed pale.** Foundry drives tab colour from theme variables and
  from selectors reaching the anchor directly, so a rule on a plain `.item`
  never took effect. The variables are redefined in this scope and the colour is
  forced on the anchor. The `important` there is deliberate and commented: it is
  the only reliable way to win against a theme whose rules we cannot reorder.

## Talents and flaws

Two more item types and two more compendia, covering steps 9 and 10 of the
worksheet.

**C&S Talents — 34 entries** from the Special Abilities & Talents table on p88,
each with the span of the d100 that produces it and its PC Point cost. Four are
marked (w) for Well Aspected characters only, and the sheet dims one held by a
character of the wrong aspect. Thirteen carry no price at all: the table gives
them as "Random roll only", meaning they cannot be bought and must be come by on
the dice.

**C&S Flaws — 75 entries**: 39 deficiencies and defects from p95, the five rows
of the 1D10 table at the foot of that page, and 31 phobias from pp.96-97. Flaws
grant PC Points rather than costing them, and the Background & Social tab totals
the two against each other so a player can see what a flaw is buying.

A phobia carries a severity, and the Willpower penalty for facing it follows:
-10% minor, -20% major, -30% severe. A minor phobia has a 13% chance of proving
major and each major one a further 13% chance of being severe. A character of
Ferocity 16 or better may use their FER Attribute Roll instead of rolling
Willpower, and pious laity may take a flat -15% rather than rolling at all.

Both tables cite the page an entry is *described* on rather than the page its
table sits on. Once a talent has been rolled, the table it came from is of no
further use; where to read what it does is what a player wants at hand. They sit
side by side on the sheet, since three short columns leave most of a row empty
on their own.

### What was transcribed rather than parsed

The 1D10 table at the foot of p95 is five rows, and every one of them is
awkward: the names sit in a column to the right of the costs, two wrap onto the
line below their roll and two onto the line above it, and the page's prose runs
close enough alongside to be picked up as a continuation. A parser that coped
with all of that would have been longer than the table and harder to check, so
those five rows are written out in `tools/extract-traits.py` with the reasoning
beside them.

## Attempting a skill untrained

"Some skills cannot be attempted unless the character has basic knowledge of the
skill" (p33) — which means the rest can. A character who has never learnt to
swim can still try, at the **Unskilled** chance for the skill's Difficulty
Factor rather than the Skilled one, with the attribute bonuses that are theirs
either way but nothing for level, category or mastery, and a failed attempt
worsens the Crit Die by two.

The machinery for that was already there: a skill held at Level 0 uses the
Skilled chance with no bonus, and one marked unknown uses the Unskilled chance.
What was missing was any way to attempt a skill that is not on the sheet at all
— and nothing is added to the sheet when you do. A skill a character does not
have is not something they own, and listing every skill they might one day
attempt would be listing the whole book. The button is on the Skills tab.

**Which skills forbid it** is marked `[TR]` — training required — in each
skill's *description*, not anywhere in the skill list, which is why it had never
been read. It is now extracted by finding each skill's description from its
cited page and looking for the marker: **60 of the 248** require training, and
they are not offered for an untrained attempt.

Twelve of those descriptions cannot be found by name, because the list and the
description word them differently — five kinds of Animal Riding share one
heading. Those twelve were read from the book by hand and recorded in
`tools/extract-skills.py`, so that re-running the extraction does not lose the
answer. Six of them require training: Winemaking, Glassblowing & Glazing, both
Own Language skills, Sailmaking & Rigging and Garrotting.

### Skills without basic knowledge

They are listed in a section of their own on the Skills tab rather than mixed
into Secondary, because they roll on a different line of the table and a sheet
that files them beside skills the character actually has reads as though they
have them.

The flag stays a flag rather than becoming a fourth category, because the two
answer different questions. Basic knowledge decides *which chance* is rolled —
the Unskilled column of Table - Difficulty Factors rather than the Skilled one.
Category decides *what the Personal Skill Factor is adjusted by* — +10 for a
vocational skill, nothing for a Secondary, -10 for a hobby. They are
independent: a skill a vocation lists as Primary is Primary whether or not Level
0 has been paid for yet, and that is exactly what a player wants to know when
deciding what to buy next. Made a category, the information would have to be
thrown away and then guessed at again on purchase.

So the untrained section shows each skill's category as a tag: what it will be
worth once basic knowledge is bought.

## Birth signs and curses

**Table - Birth Signs & Skills** (p53). Each of the twelve signs inclines
towards two skill categories and one attribute. A well or neutrally aspected
character takes two favoured skills, a poorly aspected one takes a single skill,
and each is worth +2 levels and +10% PSF — or +20% and a free mastery where it is
one of the character's vocational skills. Both halves of that were already on a
skill as `mastered` and `sunsign`, ten per cent apiece; what was missing was the
table saying which categories a sign favours. Skills in those categories are
marked faintly on the Skills tab, so the choice is visible.

The favoured attribute belongs to **Table - Birth Omens** (p54): rolling
attributes at random, a Well Aspected character rolls his favoured one with an
extra 2D10 and keeps the best two dice, a Poorly Aspected one the worst two.

**Table - Curses** (pp.85-86) and **Table - Allergies** (p87), never previously
extracted. Thirty-five curses covering every face of the d100 — including the
98-99 "twice cursed" and 100 "thrice cursed" that a player's spreadsheet of the
same table stops short of — and six allergies. They ship as flaws with their roll,
their die and the page they are printed on, and nothing else. What a curse does
is the rulebook's and is not shipped — not in its wording nor in a paraphrase of
ours, which is the same bargain the spells and the other flaws are held to. Each
carries a short name from `tools/curse-labels.json`, in this system's own words,
only so that one entry can be told from its neighbours.

## Experience Level

**Table - Total Experience Points** (p45). A skill may be raised to the
character's Experience Level at its ordinary cost; past it, every level of the
difference is paid for again. The level is shown beside the available
experience, with the next threshold on hover. Beyond level 20 each further level
costs another 30,000.

## Acts of Faith

The vocation tables on pp.145-146 say who may perform each Act and at what
Personal Faith Factor, and nothing else. Everything an Act actually does is in
its description (pp.441-454), set out with dotted leaders — PFF, SC, Cost —
and those are now extracted and merged in. Of 48 Acts, 46 have a description;
Greater Miracle and Prayer for Strength of the Holy are named in the tables but
have no entry of their own.

**A success chance is a formula, not a number**: "Faith TSC%", "2/3 Faith TSC%",
"Recipient's Spirit AR". It is kept as written, since it is measured against the
supplicant or the recipient. Ten Acts are marked **Auto** and always take effect
— the Sacraments, which "always succeed and are never" in doubt — and none of
those has a success chance, which a test checks.

**Costs name whose Fatigue they take**: "-3 FP from Supplicant", "-Crit Die FP
from Cleric", "-6 FP from Priest". Supplicant and recipient need not be the same
person.

**The marks on a name are carried**: † for Acts "solely within the competence of
ordained priests", ‡ for those open also to monastics and Holy Fighting Orders.
Twenty-seven are ordained-only, seven the wider reservation.

**The book disagrees with itself twice.** The vocation tables give Baptism PFF 20
and Ordination 45; their descriptions give 15 and 40. Checked by position on the
page, so it is the book rather than the extraction. Both figures are carried, the
description's is used as the fuller entry, and the compendium entry says so.

As with the spells, no description text is shipped: each Act carries the pages it
is printed on.

### Spirit, and what moves it

"Faith does not measure belief in a Deity. That is represented by Spirit"
(p400). Current Spirit is shown on the Faith tab as what it makes of the
character — **Table - Perceived Faith**, from Atheist at nothing through Lapsed,
True Believer, Devout and Fervent to Saintly at 50 and above. Unlike Body and
Fatigue it can rise far above where it began or fall away to nothing, so it is
not capped.

Developing the Faith skill entitles a character to **+1 Current Spirit for every
5% of Personal Skill Factor**, rounded up, in the religion he learnt it in. The
figure is shown but not added for him: the rules make it his to take.

**Performing an Act moves it.** The intercessor expends Current Spirit equal to
the Act's Fatigue cost. Granted, he has it all back, and one more if the Crit Die
came up ten. Denied, he has only half back — "he believes his Deity may have
forsaken him". On a critical failure, none at all. So a success is free, an
ordinary failure costs half the Act's cost in belief, and a critical failure
costs the whole of it. The card says which happened.

**Table - Miracles Believer's Bonus** and its unbeliever counterpart are
recorded. Witnessing a miracle of one's own religion raises Current Spirit;
witnessing another's raises belief in that faith and lowers it in one's own,
which is why those entries are pairs. Nothing yet drives them — they need a
witnessing workflow — but the figures are there.

### Spiritual aura

"Beings, locations, objects... that possess a large amount of Spirit (positive
or negative) radiate a field, or aura, of power" (p404). Current Spirit divided
by ten gives its strength, each point reaching a quarter of a mile and worth 5%
either way to every roll made within it. The Faith tab shows both figures;
applying them is the Gamemaster's, since it depends on who is standing where.

**Spirit is no longer floored at nothing.** p400 says it can "lapse into total
non-existence", but p404 speaks of "those with low or negative Spirit", whom
evil spirits are drawn to, and gives them a negative aura. A man may believe
less than nothing, and a run of failed Acts will take him there.

The book says the aura is Spirit "divided by 10 (round down)", which taken
literally would make a man of -15 Spirit radiate more strongly (-2) than a man
of +15 radiates (+1). The two are treated alike here: the magnitude is rounded
down and the sign kept.

A group may combine its auras. The Spirits are added and the aura taken of the
whole rather than the auras added, so a dozen men of nine Spirit apiece radiate
nothing alone and ten points together — which is what a congregation is for.

### A miracle witnessed

The button on the Faith tab applies Table - Miracles Believer's Bonus and its
unbeliever counterpart (p401) to everyone selected on the canvas, a miracle
being seen by all present rather than by one character. What each takes from it
depends on whether he worked it, whether it was worked upon him, whether he
shares the faith, and whether the Crit Die made it plainly divine.

One of another religion **gains belief in the faith he has just seen at work and
loses it in his own** — which is how conversion happens to a man against his
will. A character keeps one Current Spirit rather than one per religion, so the
loss is applied and the gain reported for the Gamemaster to record against the
new faith.

### Who may be prayed for

Table - Requests for Divine Aid (p403). "The person praying has no 'power' to
do anything himself", so what limits him is belief, and for the clergy, office.
A layman prays for himself alone; a **True Believer** may name someone
*instead* of himself; a **Devout** for one in addition; a **Fervent** for half
his Spirit besides; a **Sainted** for his Spirit. A monastic reaches five times
his Spirit, an ordained priest ten, and a Priestly Mage three, his attention
being divided.

Whichever is the greater applies, which is almost always office. The Faith tab
shows the figure, and an Act aimed at more people than that is refused with the
number he is allowed.

### The Belief Pool

A clergyman need not spend himself. "Acts of Faith which are performed for a
congregation or for a community of believers can call upon the Belief of those
participating" (p403) — which is the only way the costlier Acts, at 33 or 48
Fatigue, can be paid for at all.

The Faith tab records the congregation, its building and any shrine, and a
button draws the pool at a service. Each figure is a multiple of a d10, so it is
rolled rather than counted: a small rural congregation is 1d10, a very large
town one 3d10 and half a fourth, and a cathedral with a national shrine adds
sixteen dice more. A shrine's bonus is cumulative with its building's.

What is drawn stands until it is spent. An Act takes from the pool first and
from the clergyman himself only for the remainder — and only that remainder
costs him Spirit, since it is what he himself paid.

### Performing one

A success chance is a formula measured against whoever is concerned, so it is
read rather than reduced to a number: an optional fraction, whose figure it is,
which figure, and a modifier. Clauses joined by **then** are rolled one after
another and all must succeed; **plus** adds a figure into the same roll; a
semicolon separates alternatives, of which the first is taken.

So "½ Recipient's Faith TSC, then ¾ Cleric's PFF" is two rolls against two
different people, and "2/3 Faith TSC, plus Cleric's PFF" is one roll against two
figures added. Every success chance in the book parses.

The figures are the character's chance in the **Faith** skill, his **Personal
Faith Factor**, or an **Attribute Roll on Spirit**. An Act measured against the
recipient needs one targeted, and says so rather than rolling against nobody.

**Costs name whose Fatigue they take** — the one praying or the one prayed for —
and may be a figure, a third of all he has, the Crit Die of the roll just made,
or a figure repeated per hour. They are taken from the right character, and fall
on Body once Fatigue is gone, as any other magickal cost does. Two Acts say only
"Variable" or "See Below"; those are reported as written rather than guessed at.

**The Sacraments ask no roll.** An Act marked Auto takes effect and only its cost
is settled.

**Standing gates the marked Acts.** A character is a layman, a monastic or an
ordained priest, recorded on the Faith tab: † Acts need ordination, ‡ Acts need
at least a monastic or a Holy Fighting Order. A Personal Faith Factor high
enough is not sufficient.

## Skill categories

There are three, and only three: Primary, Secondary and Tertiary.

The system used to carry Core and Background as categories of their own. They
never were. The rules make both Secondary Skills "unless they are listed as
Primary (or Vocational) Skills for the character's chosen vocation" (p119), and
a vocational skill that is also a background skill "receives no additional
bonuses for being part" of both — so there is nothing for a fourth or fifth
category to do except invite a bonus that does not exist.

Where a skill came from is still worth knowing, so it moved to an `origin`
field: chosen, core, background or vocational. It carries no adjustment and
shows on the sheet as a quiet tag. Existing characters migrate automatically —
a skill whose category was core or background becomes Secondary with its origin
preserved.

The one bonus that does attach to background is now implemented: a character of
gentle birth gains +10% PSF in Leadership, and in Courtly Love outside the Early
Feudal period. There is a Gentle birth toggle on the Background & Social tab.

## Defences

An attack is declared against somebody, and that somebody says how they are
meeting it before the dice come out (p270). Target a token, roll the weapon, and
the target is asked what they declare — offering only defences they could
actually make, since there is no sense offering a shield block to someone
carrying no shield.

Which form of combat is in use is a world setting, **Combat defences**, under
Configure Settings.

**Basic** folds the defence into the attacker's chance and rolls once: half the
defender's PSF% for an active defence, a quarter for a passive one. The
defender never rolls.

A defence is measured by whatever makes it, and a creature's tusk carries its
own Personal Skill Factor rather than naming a skill. Both are reduced to the
same shape — a name, a skill factor, a chance and a Difficulty Factor — so a
boar can interpose its tusk exactly as a knight interposes a sword.

A **passive defence** interposes a weapon or shield rather than avoiding the
blow (p278) — the shield by preference, being the larger obstacle. It is never
rolled under either form of combat, so a quarter of the defender's PSF% in that
weapon or shield comes off the attacker whichever mode is in use, and it costs
neither Action Points nor Fatigue.

**Advanced** rolls both and reads them together, which is what lets a shield
absorb a blow it stopped. The four outcomes are the ones the rules give: a hit
against no defence or a failed one lands; a hit against a successful defence is
taken by the defending item; a miss against a successful defence hands the
defender a combat advantage; and a Critical Success needs a Critical Success to
turn away entirely — an ordinary defence against one reduces the blow to a plain
hit rather than stopping it, which here means losing the Crit Die.

A weapon parry is rolled at the defender's skill less the attacker's PSF%, a
dodge at its own less the penalty for what the defender is wearing, and a shield
block gains the shield's own bonus.

### Shields

**Ten shields** from the table on p279, in the armour compendium. The absorption
table on p260 covers body and head only, so until now a shield block had nothing
to block with. Each carries the bonus it gives to a block and what it absorbs of
each damage type, and an accumulating failure chance for blows that get past it.
"Any object at hand" ships with its absorption at zero, because the rules have
the Gamemaster set that at the start of a combat.

## Absolute Strength

The Absolute Strength Rating is the square root of Lifting Capacity, rounded
down, and three things follow from it (p106):

- **A bonus to Strength Attribute Rolls**, equal to the rating. A Strength roll
  therefore does not match the AR table on its own — Devlin's Strength of 14
  reads 73% there and 86% on the sheet — so the figure is marked with an
  asterisk and says why on hover.
- **The damage bonus**: half the rating rounded up for medium and heavier
  weapons, a quarter rounded down for light ones. The two round opposite ways.
- **The tie-break in a contest of strength**: where both parties succeed at
  their Strength roll, the one with the *lower* rating wins, having had to try
  harder. The rating is reported on a Strength roll's chat card so the two can
  be compared.

Which reading gives the damage bonus is a world setting, because p281 gives it
as the Strength attribute halved rather than the rating. The rating is the
default.

## Rolling against a chance

Everything else in the system rolls against something it can look up. The button
beside the macro bar is for the rest of a session: a Gamemaster calling for a
check against a number they have just decided, or a player rolling for something
the sheet has no entry for. It asks for a chance, rolls a Percentile Pair and a
Crit Die against it, and reads the result as any other check.

The Difficulty Factor is optional, and that is the point. Name one and the roll
behaves like a skill check — the chance is clamped to that Factor's band and
whatever falls outside becomes a Crit Die modifier, settled by the same function
so the two cannot drift apart. Leave it out and the number typed in is simply
the number to roll under, which is what someone improvising a check usually
means.

It also asks for a Crit Die modifier. Plenty of things move that die without
touching the chance — a weapon, a range, a spell — and a free-form roll cannot
know which, so it asks rather than guessing. Anything produced by naming a
Difficulty Factor is added to it.

There is also a keybinding, deliberately unbound: a system claiming a key
uninvited is a nuisance to anyone who had it bound to something else. Bind it
under Configure Controls. From a macro it is `game.cns5.quickRoll()`, which
takes `{ chance, df }` to skip the prompt.

## Tokens

Body and Fatigue are declared with a maximum in the schema even though the
maximum is worked out afresh on every preparation. Foundry decides which
attributes can be a token bar by walking the *schema* for a value-and-maximum
pair, not by looking at the prepared data, so a maximum that appears only after
preparation makes the attribute a bare value — and the bar fills its numerator
with nothing behind it.

The bars are set on the prototype token when an actor is created rather than
through the manifest's `primaryTokenAttribute`. Those keys set a token's bars
invisibly: the token configuration showed nothing chosen while the bars filled
anyway, which cannot be corrected because there is nothing on screen to correct.
A creator who has already chosen their own bars is left alone.

## Dice

"Use a different coloured dice for the Crit Die" (p36). On a physical table that
is a matter of picking one up; here the two land together and look identical,
which is the confusion the suggestion exists to prevent.

Where **Dice So Nice** is installed, the Crit Die rolls in oxblood and the extra
die a critical adds rolls in gilt. The Percentile Pair is deliberately left
alone — a player's own dice are their own, and recolouring everything to solve a
problem that affects one die would take that away.

It is a client setting, **Colour the Crit Die differently**, so each player
decides for themselves. Nothing in the system depends on the module: setting an
appearance on a roll is inert without it, and the registration happens on a hook
that never fires when it is absent.

## Missiles

Table - Missile Ranges (p258) is a table of *pairings*, not of weapons. A bow's
damage, its reach and its Crit Die modifier all belong to the bow and its arrows
together: a longbow shooting hunting arrows does 14 and reaches eight hundred
feet, the same bow shooting armour-piercing arrows does 17 and reaches four
hundred and fifty. None of those figures is a property of the bow, which is why
an earlier version treating each row as a weapon could not express any of it.

**Ammunition is its own kind of item**, not a weapon. Treating a quiver of
arrows as a weapon put it in the weapons list waiting to be rolled as an attack,
gave it a set of ranges belonging to no particular bow, and let it be confused
with the bow that shot it. None of that follows from the rules: an arrow is not
a weapon, it is what a weapon shoots. An arrow carries what Table - Missile
Weapons gives it — damage, the Crit Die modifier from its head, a bash chance —
and nothing else. Weapons no longer carry ranges at all.

**Twenty-five profiles** are extracted, each a launcher with a kind of
ammunition or a thrown weapon with itself. Loosing a launcher asks what it is
loaded with — from the ammunition actually carried — and at what range, then
looks up the pairing. A missile loosed is decremented.

### Throwing is an action, not a kind of weapon

There is no throwing axe to buy because what a character throws is the War Axe
already on their belt. The ranges table names the act — "Thrown Axe", "Thrown
Knife" — while the weapon list names the thing, and the two are matched up. The
same holds for a knife, a pilum, a war javelin and a hunting spear, which the
ranges table calls a hunting javelin.

So a weapon has one of three parts to play — held in the hand, shoots something,
or is shot — and anything with a thrown profile asks which is meant when it is
used. An earlier version made "thrown" a role of its own, which meant a pilum
could be hurled but not thrust with: half of what its row in the weapon table
gives it.

Both answers change more than the ranges. Thrown damage is its own figure and
usually the larger — a War Axe does 5 in the hand and 8 thrown — and the skill
differs too: an axe is swung with **Axes** at Difficulty Factor 4 and hurled
with **Hurling Axes** at Difficulty Factor 3, whose prerequisite is Axes. The
prompt shows what each is worth before the choice is made.

**Strength tells at a distance** (p258). A character of Strength 12 or better
modifies the Crit Die by the amount the table gives for that missile at that
range, and reaches fifty feet further per point above twelve — but only at
extreme and maximum range, where the shot is a matter of how hard it was loosed
rather than how carefully aimed. A crossbow is indifferent to all of it, the
windlass having done the work.

### Which way a Crit Die modifier goes

A modifier is applied in the character's favour either way: it *increases* the
Crit Die of a successful roll and *reduces* that of a failed one (p37). A +5
therefore takes a success from 8 to 13 and a failure from 8 to 3 — the same
modifier, making a good roll better and a bad one less bad. Both worked examples
bear it out: a surgeon's 8 raised to 11 on a success, and a brewer's 4 raised to
5 on a failure by an unfavourable modifier.

The chat card shows each modifier with the sign it was *applied* with rather
than the sign it was written with. Printing "+5" beside a die that went down by
five reads as a fault rather than as the rule, and the card said exactly that.

### Distance costs a shot its chance

Nothing for short range, -5% at medium, -10% at long, -20% at extreme and -30%
at maximum. The row sits *above* the band names rather than among the columns of
Table - Missile Ranges, which is how it came to be missed: the table proper is
read from the row of headings downwards, and this line is above them. Without it
every shot was made at its short-range chance however far away the target stood.

It is a separate thing from the Crit Die modifier for range, and easily confused
with it. At extreme range a longbow with war arrows is -20% to hit and -15 on
the die: the first is the same for every weapon in the game, the second belongs
to that pairing alone. The range picker shows both, since the chance is what a
player is choosing between.

### What modifies the Crit Die

Three things do on a shot, and only one on a blow. A melee weapon has a modifier
of its own — a broadsword +1, a halberd +2 — and it is added to the die.

For a shot it is the missile's modifier that tells, not the launcher's: every
bow and crossbow in the table modifies the die by nothing, while an arrow gives
+2 and a heavy bolt the same. Taking the launcher's figure and ignoring the
arrow's therefore lost every missile between one and two on the die, which is
the difference between a critical and an ordinary hit on two results in ten.

So a shot gathers the missile's modifier, the range bracket's, and the shooter's
strength. Edward at Strength 15 with a longbow and war arrows at medium range
takes -4 from the bracket, +3 from his arm and +2 from the arrow, for +1. The
chat card shows the workings, since a modifier silently going missing is exactly
what happened here.

Ammunition appears on the Core & Combat tab, where a shot is made, and among
the arms on Personal Chattel, where its weight counts against what a character
can carry.

Asking what a launcher *takes* is a different question from asking what a
missile *is*, and the two were being answered by the same function. A bow's name
contains no "arrow", so no ammunition ever matched a bow and every shot fell
back to the default loading — which is why a quiver of armour-piercing arrows
made no difference to anything. A crossbow has to be tested for before a bow,
since its name contains one.

Where nothing of the right sort is carried the shot is still allowed, since
refusing it would punish anyone not tracking arrows, but the loading is named as
an assumption rather than passed off as a choice. `test/templates.test.mjs`
checks that every registered item type is surfaced somewhere on an actor sheet:
a type that is registered, built into a compendium and created on drop but
listed nowhere looks exactly like a drop that failed, and there is nothing on
screen to suggest otherwise.

### Names that differ between the tables

The weapon list and the ranges table do not always agree: a Throwing Knife
against a "Thrown Knife", a Roman Pilum against a "Pilum", War Darts against a
"Dart", Armour Piercing Arrows against "AP Arrow". A near miss here is silent —
the weapon finds no row, no range is asked for, and a thrown knife is swung
instead. Those names are matched explicitly, and a test names each pairing, since
every one of them failed quietly.

### What the tables leave open

Hunting Bolts name no crossbow and the others each name their own, so it is not
said whether a heavy crossbow will take a light bolt. Anything that is a bolt
loads anything that takes bolts, and the question is left where the rules left
it.

Hunting Bolts have no row of their own. They are generic civilian bolts usable
in any crossbow, so a crossbow loaded with them falls back to its own row.

Sling stones are nowhere given as an item. The ranges table prints a profile for
a sling with no ammunition named, which is taken to be stones.

## Targeting a spell

Casting a spell and targeting it are separate acts (p296). Casting makes the
pattern; targeting carries it through the Shadow World to where it is wanted,
and it is targeting that everything in the way interferes with. The roll the
system makes is the targeting one.

A caster's Mode of Magick chance is reduced by the target's own resistance, by
whatever stands between them, and by the distance; adjusted for how either is
moving; and raised by half again if the target wants the spell. Three tables
drive it:

- **Target's Magick Resistance** — what a target resists by for being what it
  is. A man resists nothing, a wood elf ten, a clan dwarf twenty, a Lich forty.
  It is read from the target's race, most particular answer first, so a Wood Elf
  is not mistaken for an Elf; anything the table does not name resists nothing
  and says so rather than guessing.
- **Targeting Movement Penalty** — as often a bonus. A target standing still and
  in view is +10%, one charging the caster likewise; a caster on the move is
  -10%.
- **Targeting Modifiers for Obstacles** — foliage -10% through lead -25%, and
  **True Lead, which no spell passes at all**. That one is reported rather than
  added: rolling against a very small number would say "unlikely" where the
  rules say "never".

The targeting dialog asks a great deal, so its questions scroll within a capped
height and the Roll button, in the dialog's own footer, stays in view. At full
length it had pushed the button off the bottom of the screen.

A physical effect may be **dodged** by a target who is fully alert and at least
fifty feet away, their Dodge PSF% coming off the caster. One closer than that
has no time.

### Ranges and durations

The spell tables print **one** figure for range and it is the *maximum*. Short
range is a tenth of it and long range a half (p296), so both are worked out
rather than entered — the sheet used to offer three boxes and leave two of them
empty, which asked the player for something the rules derive.

Nearly every figure is a quantity multiplied by the caster's Magick Level:
`10' x ML`, `3 min x ML`, `1 mile x ML`. Some add a fixed part (`5' + 1' per
ML`), some count down (`60 seconds - (5 x ML)`), and a few grow shorter with
skill (`60 min / ML`). All of those are read and worked out, in feet or seconds,
against the caster's own level — so a spell's reach changes as its caster
improves, which is why it cannot be stored.

Three things are not figures and are not treated as failures to read one:

- **Words** — Touch, Self, Instant, Permanent, Until Dispelled. A spell cast by
  touch has no range in feet and never will, so it is carried through as what it
  is rather than turned into a nought.
- **Named unknowns** — `10' x ML x Density`, `15 seconds x Volume`. The term is
  named and nothing is invented for it.
- **Instructions** — "Concentration", "Until Destroyed", "Per Type of Fire".
  Shown as printed.

Every one of the 313 printed ranges resolves to one of those. Durations are less
tractable: a couple of dozen are instructions rather than quantities.

### Learning a spell

Days to learn are **cumulative**: a spell of Magick Resistance 3 costs the step
to 1, the step to 2 and the step to 3 added together, which for a mage of Magick
Level 5 is 3 + 6 + 9 = 18 days. A mage may not learn a spell of Magick
Resistance above his Magick Level plus two.

**The book's table and its formula disagree.** The formula is printed as
"21 x (MR / (ML +2)) (round down)", and rounding down is wrong in thirty of the
table's seventy-two cells, always by exactly one. Rounding to nearest matches
every cell without exception, so the table is followed and the word in the
formula treated as the error. A test checks all seventy-two.

**What a tradition makes of a school.** Table - Spell Magick Resistance
Modifiers is a grid of thirteen Methods against fourteen Modes, and each cell
raises or lowers a spell's Magick Resistance for a mage of that tradition. Since
the days go as that figure, the effect is large: a Command Magick spell of
Magick Resistance 4 is three points harder for a Conjurer and three easier for a
Necromancer, which at Magick Level 5 is eighty-four days against three. It never
falls below one — no spell is free to learn however well it suits.

The table abbreviates its headings, and spells Thaumaturgy "Thaumatrugy". The
data keeps the page's spelling and the matching copes with it.

**Also implemented:** the days of research a book or scroll demands before the
roll, the minimum span and the retry cost of inventing a spell, and the chance
of inventing one on the spot.

### Casting one from the sheet

Clicking a spell's name casts it, as clicking a weapon's name attacks with it
and a skill's name rolls it. Editing is a button among the controls. The magick
tab used to have this the other way round: the name opened the editor, and
casting meant finding one of three small numbers further along the row.

Those three numbers are gone. They were the chance at short, long and maximal
range, and they predated targeting — taking no account of the target's own
resistance, of movement, of obstacles or of the mana of the place. They were
right only against an unresisting target standing in the open. In their place is
one figure, the caster's chance in that school before anything is counted, and
the range at which it is cast is chosen when it is cast.

A spell that offers its target a save is marked in the list, so a caster can see
before casting whether there is one to come.

The same gesture now means the same thing on every tab. A row's name **rolls**
the thing where there is something to roll — a weapon, a spell, a skill, an Act
of Faith — and **opens** it where there is not. Two lists disagreed: an armour
piece's name equipped and unequipped it, silently changing what the character
was protected by; and an ammunition row's name was plain text that did nothing
at all when clicked, with nothing to say why. Equipping is a control among the
others now, as carrying already was on the Personal Chattel tab.

### Getting past what protects the target

"If the target is protected by Magick, the spell may have to overcome those
protections before the intended victim may himself be targeted" (p298). Each
protection is targeted in its own right, outermost first, at the same chance as
the victim but resisting by its own Magick Resistance — and a spell that fails
against one goes no further.

- A **Ward or Circle** "is targeted as if they were the Mage who created them",
  so it resists as he would.
- An **Amulet of Protection** resists by 5% for every level of the spell in it,
  and 2% more for every 25 years of its existence. Overcome it with something
  harmful and its own spell discharges for 1d10 days.
- A **Focus** its bearer has raised in defence resists the same way, by the
  strongest spell in it — but if it fails to stop the spell there is a 20%
  chance it turns on him.

Wards and Amulets are kinds of magickal item, listed on the Magick tab; a Focus
is raised in defence by a box on its own sheet. Each attempt is a step on the
chat card, with what it resisted by and whether the spell got through.

### Aiming by meditation

An optional rule (p298): a mage may store up meditation in one spell per Magick
Level, gaining +1% per Magick Level a day to his targeting, or +2% if he fasts
and does nothing else, to a ceiling of +25%.

It is easy to confuse with the meditation that lowers a target's save (p301),
since both are a point a day to a ceiling of twenty-five. The difference is that
this one is multiplied by the caster's Magick Level and kept in a single spell,
where that one is spent on a casting. Both are asked for separately.

### Spells fade rather than stop

"Once the time limit is reached, the spell degrades over a 1D10 minute period"
(p296). A spell that lands with a duration to run out has its fade rolled and
noted on the card.

### Resisting a spell

A spell that reaches its target may still be thrown off by them, where the spell
is one that works on the mind. **Willpower TSC% less the caster's Method of
Magick PSF%** (p300), rolled by the target after a successful targeting.

The two bounds are checked against the **unmodified** die, which is what keeps a
save from ever being hopeless or certain: 01-05 always resists whatever the
odds, and 96+ never does. A target with a save of nothing left can still shrug
off the strongest mage one time in twenty.

**Which spells offer one** is prose in each spell's description rather than a
column in any table, so the system follows the book's own rule of thumb —
anything that charms, commands, lures, frightens, holds, confuses, panics or
makes one hallucinate — and lets a Gamemaster set it either way on the spell.
That catches 84 of the 313: every Command Magick spell and every Illusion, plus
a handful elsewhere. Commanding an *element* is excepted: "Create / Command Air"
reads as a command spell and is nothing of the sort.

**What lowers a save** is the caster's doing and is asked with the targeting: a
presence of Appearance or Bardic Voice above 14 (-5% per 2 points, rounded up),
mantra gestures (-5%), dancing or chanting (-5%), smokes and essences (-10%),
and days spent meditating (-1% a day to a maximum of -25%, spent once).

**A note on the two resistances.** A target's *Magick Resistance* — what it
resists by for being a dwarf or a Lich — is subtracted from the caster's
targeting chance and has nothing to do with this. The save is a separate roll
made afterwards by the target themselves. They are called different things here
for that reason.

### What a spell costs

Fatigue, "or if exhausted, Body Points" (p296) — so a caster with nothing left
pays out of their own substance, and the system will take them below zero and
announce it like any other wound. The cost is taken whether or not the targeting
found its mark.

Three things multiply it, and they apply together:

| | |
| --- | --- |
| Low mana | doubled |
| High mana, or the Shadow World | halved, rounding up |
| From a scroll or book | halved |
| From a device, by a Mage | a quarter, and a charge |
| From a device, by anyone else | halved, and a charge |
| Extending the range by half again | doubled |

So a scroll read in a high mana place costs a quarter of what memory costs in a
low one. The Shadow World also gives +10% to any Mode of Magick.

### Magickal items

A **Focus** is not a way of casting but an aid to it. A mage casts from memory
*through* his Focus, so it is offered as a choice of its own and layered on top
of whatever else bears on the casting rather than chosen instead of it. An
earlier version listed it as a casting source beside scrolls and devices, which
is the wrong shape.

Cast through, it sharpens the caster's skill in the school and his aim, and
lightens the cost — and since the target's save is measured against that same
skill, it makes the spell harder to shrug off too:

| | Simple | Lesser | Greater |
| --- | --- | --- | --- |
| Method of Magick | +7% | +13% | +26% |
| Targeting | +5% | +10% | +15% |
| Fatigue | less 2 | halved | quartered |
| Stores, per maker's level | 3 MR | 7 MR | 13 MR |
| Weeks to make | 3 | 7 | 13 |
| Least Magick Level to make | — | 3 | 6 |
| Without it, once attuned | -14% | -26% | -42% |

The Fatigue reduction comes last, lightening whatever the mana of the place and
the source have made of the cost, and never takes it below one. Only a Focus the
caster is carrying and is attuned to is offered.

Table - Magickal Devices on p303 summarises these, and the fuller entries on
pp.304-305 add two things it leaves out: the targeting bonus, and the store of
spells. The fuller entries are followed.

A **Device** holds spells and charges to cast them with. A Simple one holds a
single spell of MR 7 or less; a Lesser up to thirteen, totalling MR 21, with none
of MR 7 or more — so six at most, a *lower* ceiling than the Simple Device's and
easy to get backwards; a Greater any number, totalling twenty-one times its
maker's Magick Level. The item sheet says when the spells placed in one break
those limits.

**Getting a spell out of an item is a roll of its own**, before any targeting
(p301), and it differs by kind:

- a **Device** — a wand, a ring, a staff — answers automatically for a caster
  who knows the spell at MR 0. Otherwise it is the maker's chance less 5% a point
  of the spell's Magick Resistance, which always applies to a non-mage. A success
  spends one charge; **a failure spends a charge for every point of Magick
  Resistance**, and the spell goes nowhere.
- a **Scroll** is read at its writer's chance, and crumbles either way.
- a **Focus** holds spells its maker placed in it, at a charge a point of Magick
  Resistance.

**What the bearer pays**, from p297: a quarter of the spell's cost from a
device for a mage and half for anyone else, rounded up, and half from a scroll
whoever reads it. So Charm, costing 6 from memory, costs a mage 2 from a wand and
anyone else 3. The card names the rate it used — "2 FP — a quarter of 6, being a
mage" — since the figure alone looks like an error. A spell drawn from a Focus's
store is paid for in charges instead.

The whole casting is declared before anything is rolled: the mana of the place,
the range, what stands between. That is the order a player says it in, and the
only order in which the mana can bear on the cost, since the cost is paid at the
casting roll whether or not the spell comes out. An earlier version asked the
mana only when aiming, after the Fatigue had been taken, so a low mana place
never doubled what a device or scroll cost.

So a scroll makes two rolls and perhaps a third, and the card heads each:
**Step 1 — Casting the spell**, boxed above the dice with its own roll and
target; **Step 2 — Targeting it**, the main dice; **Step 3 — the target's save**
where the spell allows one. If the casting fails the card shows that roll as its
dice and says there is nothing to target. Both of the first two rolls start from
the writer's skill, which is why they can look alike, but the first is the bare
figure and the second carries every targeting modifier — the distance, the
target's resistance, what stands between.

An earlier version made only the targeting roll and spent one charge flat, so a
wand in untrained hands worked exactly as well as in its maker's. A spell on the
sheet is taken as learnt to MR 0, since nothing yet records one learnt only
partway.

**Scrolls** hold exactly one spell, of a band fixed by grade — Simple MR 1-3,
Lesser 4-7, Greater 8 and over — and are spent the moment they are read. A spent
scroll is kept, greyed, rather than deleted: something that has just happened at
the table is worth being able to see. Reading one needs the language at 65% and a
Read Language roll (p301), which is left to the table.

**Two things that read otherwise but do not.** Devices *do* cost their bearer
Fatigue — p297 gives "½ normal FP (round up) for Non-mages, or ¼ for Mages plus
the spending of 1 charge" — and a Focus *does* hold spells: each grade "can store
3 x ML (… 7, 13) in Spell MR's, which can be cast for the cost of 1 charge per
Spell MR" (pp.304-305).

**On the sheet**, the Magick tab has a section for each: **Known Spells**, then
**Foci**, **Devices** and **Scrolls**. They are one item type underneath, with a
Kind that decides which section an item appears in — a dropdown rather than
boxes to tick, since an item is one kind and never two. Shown together in one
table they read alike, although they are used differently: a Focus shows what it
adds to a casting, a Device its maker's skill and its charges, a Scroll whether it
has been read. Each section's Add button makes an item of its own kind.

### The bounds on a spell's Magick Resistance

"The minimum MR of a spell is always 1 and the maximum MR is always 10. If the
modifier takes the MR of a spell above 10, then the MR remains at 10 but the
Fatigue Point cost of the spell increases by 3 FP per point above 10" (p294).
The book's own case is a Diviner learning an MR 8 Transmutation spell: his +3
takes it to 11, so he learns it as MR 10 and pays 3 FP more to cast it.

So a spell's Magick Resistance and cost on a mage's sheet are *his*, not the
table's, and the sheet shows both with the table's figures on hover. Only the
floor of 1 was implemented before.

The grid is held in `module/config.mjs` as well as in `data/magick.json`,
because a spell works out its cost while its actor is being prepared — before
any fetch could return. A test holds the two copies to the same figures.

### Spells not yet fully learnt

Learning a spell is bringing its Magick Resistance down for oneself, a step at a
time, to nought (p294). So each spell records the **MR still to learn**, and a
spell with none left is known. Every spell starts at nought on a sheet — a
character's spells are taken as learnt unless a player or Gamemaster says
otherwise — and one still being learnt is marked in Known Spells with the days
to its next step.

Cast from memory, a spell not fully learnt has first to be got into shape: a
roll against the Method at **10% off for every point still to learn** (p299). On a
failure the Crit Die of that roll gives the backfire, shown automatically:

| Crit Die | | Fatigue |
| --- | --- | --- |
| 1 | the spell fails | half |
| 2-4 | the spell fails | full |
| 5-7 | a major backfire | double |
| 8-9 | an extreme backfire — it goes off at the mage's feet | double |
| 10 | a disastrous backfire — it goes off in his hand, with double effect | double |

The last two let the spell loose where the Gamemaster must decide what it does.
A device now reads "known at MR 0" from this figure rather than from the spell
merely being on the sheet.

### Spell books

**A mage's own book** is read to cast a spell he knows only in part: "this
doubles the time required to cast the spell but means the spell is automatically
cast as if he had learnt it fully" (p307). It is his own casting, with his own
skill, at half the Fatigue as from any book — so the spell must be among his
Known Spells, however little of it is learnt.

**Anyone else's book** is read like a scroll (p301): at the writer's skill, and
"on a failure, the scroll or page is discharged" — that spell's page is lost,
and the rest of the book is untouched. A spell that works leaves the book as it
was. Which a book is follows from who wrote it: left blank, it is the bearer's
own. The Magick tab lists the two apart, since they are used so differently.

A spell takes a page for every point of its Magick Resistance, and a book is
written for one Mode of Magick and useless to another (p306); the Mode is
recorded on the book.

### A non-mage aiming a device

"Any non-Mage trying to target a spell (unless it is a touch effect whereby a
blow is required) must first succeed with a Willpower roll" (p299). It comes
between getting the spell out of the item and aiming it, for anything worked by
a command word or trigger — devices, scrolls, other people's books. On a failure
the spell goes astray, and Table - Willpower Failure says where: dispelled, the
nearest creature within thirty or ten feet, overshooting, falling short — or, on
86 and over, caught in time and aimed after all. Mages never check. Without the
Willpower skill, it is tried untrained.

On the card it sits unnumbered between Step 1 and Step 2, so the three numbered
steps mean the same on every card.

**A Grimoire is not a spell book.** In this rulebook (p307) it is a reference on
one particular demon — pages of research towards summoning and binding it, worth
+50% to the user's PSF and +1 to the Crit Die against that demon. Spell books are
**Spell Texts** (p306), built as described above. Grimoires are not built.

**A Device casts with its maker's skill, not its bearer's.** "The basic
chance of casting the spell through a Magickal device is equal to the Method of
Magick TSC% of the Magick User who [made it]", its targeting uses that same
figure, and a victim's save is measured against the maker's PSF% (p301). The
spells in it need not be ones the bearer knows. That is why a man with no magick
in him can carry a wand and use it — and why casting from a device is started
from the device, on the Magick tab, rather than from the bearer's own list of
spells.

An earlier version offered "from a device" as a casting source in the spell
dialog, which assumed the bearer's own skill and merely cheapened the cost. It
also never spent a charge: the dialog said "and a charge", and the item's
charges never moved. Both are gone.

So the maker's Method TSC%, PSF% and Difficulty Factor are recorded on the
device when it is made — the Methods run from DF 4 to 6, so the last is his own
figure rather than one to assume. What the *bearer* brings is the Fatigue: a
quarter of the spell's cost for a mage and half for anyone else (p297), and a
charge either way, spent whether or not the spell found its mark. Meditation
cannot improve a device's aim nor lower a save against it; a part of the target
used in its making gives +15% to targeting.

A device is filled by dropping spells onto its sheet. Each carries its Magick
Resistance, its cost and its reach with it, since the bearer cannot be asked.
Breaking the grade's limits is warned of rather than refused — a Gamemaster may
know better.

A spell is taken out again either from the device's own sheet, where each held
spell has a Remove button, or from the Magick tab, where a small cross sits
beside the button that casts it. The second asks first, being one slip of the
mouse from the cast button, and taking a spell out loses what was recorded of
it.

`test/templates.test.mjs` checks that every button's action has a handler
behind it. A `data-action` with nothing behind it renders as a perfectly good
button that does nothing when pressed — indistinguishable on screen from one
that works, and the thing that cannot be seen without Foundry to click it in.

**Charges follow the maker, not the bearer.** A Device made by a mage of Magick
Level 6 holds the charges a Level 6 mage gives it whoever carries it later, so
the maker's level is recorded on the item. A Greater Device made an Artefact of Power
(p304) recharges itself — seven charges a day, thirteen at a conjunction of the
Metaphysical Current. An earlier note here called the p303 summary's
"self-recharge" a contradiction; it is that ritual's result, described in brief.

**Not automated:** recharging on its schedule, the Constitution roll when a
Focus is destroyed near its maker, the penalty for casting without a lost Focus,
and the making itself beyond the hours of empowering. Those are a Gamemaster's
bookkeeping and the figures are on the item sheet to keep it with.

## Damage

## Armour coverage

Armour protects the parts of a body it is fitted over, and the parts are the
ones Table - Aimed Shot Modifiers names (p272), so coverage and called shots
speak the same language. What each class protects is stated in the prose beside
its table rather than in the table itself:

| Class | Covers |
| --- | --- |
| Light body armour (p261) | chest, abdomen, arms — "but not the groin or legs" |
| Heavy body armour (p262) | as above, and the groin |
| Three-quarter battle armour (p263) | "the entire body below the neck and to the knees" |
| Heavy battle armour (p263) | field and cavalry plate: everything below the neck |
| Super heavy battle armour (p263) | "full mail fitted from head to foot" |
| Helmets (p261) | the head; an enclosed helm the face, a visored one the throat, a hood or coif the neck |

A hauberk reaching only to the knees is not a matter of averages: "if a leg hit
occurs, roll a 1D10 with 01-07 falling on the armour rather than the unprotected
part of the leg". So a partly covered part carries a chance, the die is rolled
on the blow, and the piece either meets it or does not. The chat card names what
absorbed and what fell below the hem.

Arms are recorded in halves. The aimed shot table treats an arm as one thing
while armour is fitted to it in two pieces, so where a blow is aimed at "the
arm" a d10 settles which half it found — the rulebook uses a d10 for this sort
of question elsewhere, though it gives no split for the arm, so an even one is
used. Legs are already named in halves by the table itself. Armour that covers
"the arms" or "the legs" covers both halves of them: the tables name no piece
that covers a forearm alone, and a test asserts that no class ever covers half a
limb.

**Two things are read into the rules here.** Hands are covered from the hauberk
upward, on the reasoning that armour enclosing a whole arm encloses what is on
the end of it, and the same for feet where the legs are covered — the tables
list no gauntlets or sabatons, so the alternative is bare hands inside a suit of
plate. And a tunic or doublet is taken to leave the hands bare, being a garment
rather than a harness. Coverage is recorded on each item and editable, so a
Gamemaster who reads it differently can say so.

**An unaimed blow strikes the torso.** Hit locations are an optional rule
attached to critical hits (p282), and the location table gives the chest forty
results in a hundred on its own, so an ordinary attack is a blow at the body and
it is the body's armour that stops it. Where an aimed shot names a part, the armour over that
part is what absorbs the blow.

Protection is recorded per part of the body and nowhere else. An earlier version
kept a second, cruder record keyed to where a piece hangs — body, head, limbs —
and the sheet read that one while the damage rules read the other, so the two
could disagree and the sheet could ask for a "torso" that no cuirass covers.

On a sheet, parts protected identically share a row. Gathering them by what they
are worth rather than by where they are is deliberate: a fixed "arms and hands"
row would report a cuirass's sixteen against a bare hand, because a cuirass
covers the arm and not what is on the end of it. A knight in a maille cuirass
and a conical helm reads as two rows — his head, and his chest, abdomen, groin
and arms — and his bare hands and legs get no row at all.

A landed blow is the weapon's damage, the Strength bonus, the Attacker's Bonus
and the Crit Die. Armour covering that damage type absorbs what it can, and what
gets through comes off Fatigue Points until they are gone and off Body
thereafter.

**A Critical Success puts the whole blow on the Body.** "A hit that is a
Critical Success, where the adjusted Crit Die is 10 or higher, has all of the
damage, not absorbed by the shield or armour taken off the Body of the
character. In addition to this, a further 1D10 is rolled which is damage that is
also ignored by any armour defences" (p281). Fatigue absorbs none of it. Armour
is the one thing a critical does not ignore.

An earlier version of this system had only the extra die bypassing Fatigue,
which understated every critical hit by however much Fatigue the target had
left — often the greater part of the blow.

The attack card shows the split — the blow, what the armour stopped, what came
off each pool — and an Apply button that takes it. The button carries what each
pool loses rather than the raw damage, because the split was worked out against
the target's armour and Fatigue at the moment of the blow; recomputing on click
would use whatever they had become by then.

**A natural ten on the Crit Die is always critical**, whichever way the roll
went and whatever the modifiers would have made of it (p272). Otherwise a
penalty could take the edge off a roll the rules call decisive.

**A failed attack whose Crit Die reaches ten is a fumble.** The attacker rolls
Agility to keep hold of the weapon and the opponent takes a free blow at -20%.
The card says so; neither is rolled for you.

Under advanced combat a critical met by an ordinary defence is "reduced to that
of a normal attack success" — so the blow lands with its Crit Die and only the
extra d10 is lost. A critical defence turns it away entirely.

### The Fatigue cost of defending

Table - Fatigue cost for Defence (p284) gives it: keyed by the weight of what is
interposed and read against the same PSF% bands as Table - Combat Actions. A
dodge costs one whatever the dodger's skill; a light weapon two falling to one,
a medium three falling to one, a heavy three falling to two.

The cost is taken automatically when the attacking client has permission over
the target, and reported for the defender to take otherwise. Unlike damage it is
not conditional on anything — an active defence costs Fatigue whether it worked
or not — so there is nothing to decide and no button to press.

Shields divide three ways for this and only two for the shield play skills, so
each shield records its own defending weight: a buckler is light, a large shield
or tower shield heavy, and a target, heater or kite between them.

The same table doubles as the count of blows under the alternative combat system
on that page. That system is not implemented; the figures are the same either
way.

### Falling and dying

"Once a character reaches zero body he slips into unconsciousness... When the
character's Body Points reach a negative figure equal to the level of the
character's Constitution, the character is dead" (p282).

So the margin between falling and dying is the character's own Constitution: a
man of 18 survives a wound that kills a man of 6. Body is deliberately not
floored at zero, because the distance below it is the only thing that decides
the question.

Both sheets show the condition beside Body, with the life remaining in
brackets once a character is down. Crossing either line is announced to chat and
marks the token with Foundry's own unconscious or dead status — once, at the
moment it happens, not again for every blow that lands on a man already down.
Healing back above zero clears it.

## Checked against a player's spreadsheet

Someone built a skills-and-spells manager for this game as a workbook, and its
seven thousand formulas are a second reading of the same rulebook. Every table
it shares with this system was compared cell by cell. The 208-cell Method x Mode
grid agreed exactly, as did the attribute bonuses, weight factor, strength
ratios, Magick Levels, Difficulty Factors, Focus bonuses and the point budgets;
so did the formulas for Body, Fatigue, lifting capacity, Jump, PMF and PFF.

Where the two disagreed the rulebook settled it, and it settled for this system
each time: the workbook's Attribute Roll at 8 is 59% where p103 says 50, its
two-handed Attacker's Bonus copies the Heavy column where p282 groups
"Two-handed or Polearms" as one, its Base Action Points ignore the rule that INT
and FER above 20 do not count, and its days-to-learn skip the per-step rounding
that makes ours match all 72 printed cells.

It did catch one of ours, though — see the Magick Resistance bounds below — and
a page footer that had crept into an extraction of the Curses table. That footer
carries the name and order number of whoever bought the copy of the PDF, so it
is stripped wherever it appears, and a test now checks no data file contains one.

### Optional rules from p281

Both are world settings, both off by default, and both make wounds more
dangerous.

**Wounds beyond a character's Constitution reach the Body** — damage past the
armour that exceeds the target's Constitution comes off Body rather than
Fatigue, "the Body's ability to absorb some damage in the form of bruising"
having a limit.

**A critical's extra die explodes** — a ten on the d10 a Critical Success rolls
is re-rolled and added, and again on another ten. This is what makes a lucky
blow catastrophic rather than merely bad.

### Combat advantages

A defence that succeeds against a failed attack hands its maker an advantage.
An ordinary success lets them attack in turn if they are next in line, which
needs nothing from the system. A Critical Success buys more, and what it buys
depends on what was interposed (p280-281):

- a **shield block** may be turned into a shield bash at +10% Shield Play;
- a **dodge** leaves the attacker off balance, for +10% with any weapon;
- a **weapon parry** may be turned into a **disarm**, against which the attacker
  must make a Strength roll penalised by the defender's own skill.

Taking it up costs Fatigue by the weight of what is used, from Table - Combat
Advantages: nothing for a natural weapon, one for a light weapon or shield, two
for a medium, three for a heavy, four for a two-handed weapon or polearm — and
those last two may only counter-attack under the conditions the table gives.

The card says which advantage was earned, what it is worth and what it costs.
The follow-up itself is the player's to declare rather than something rolled for
them, since it is a fresh attack with its own target and its own modifiers.

### Not automated

Shield breakage is not rolled. `checkShield` in `helpers/defence.mjs` implements
the cumulative ten per cent, but nothing calls it: it needs to know what the
shield absorbed, which means threading the defending item through the exchange.

## The Combat Round

A round is not a list of turns taken once each. It is a series of Action
Phases: within a phase everyone acts once in order of remaining Action Points,
and when the phase closes the order is worked out again from what everyone has
left. The round continues until every combatant has spent their pool or held
what remains of it over (p268).

**Initiative is the Action Point pool.** They are one number rather than two.
The tracker already shows initiative and already sorts on it, so a pool kept
anywhere else would mean two figures that must agree and a tracker showing the
wrong one. Spending lowers initiative, which is what the rules describe: the
order of play is the order of remaining pool, and it changes as the round is
spent.

**The order is frozen for the length of a phase.** Re-sorting the moment someone
spends would move people around the list while it is being worked through, and
nobody could tell who had yet to act. Each combatant carries the index it was
given when the phase opened, and the tracker sorts on that until the phase
closes.

**How a turn goes.** Pressing next prompts the active combatant, not the one
about to act — a player does not know what they spent until they have done it.
They move, strike or cast, then say what it cost. Three answers: act and record
the spend, pass, or hold over. Holding keeps no more than Base Action Points'
worth, ends that character's round, and drops them out of the order at once.

**Actions that cannot be paid for.** The rulebook does not settle what happens
when a character declares an action costing more than their pool holds, so both
readings offered by the game's designers are available as a world setting:

The setting is **Actions that cannot be paid for**, under Configure Settings →
System Settings.

- **Disallow** (the default) — no action may be begun that cannot be completed.
  The prompt refuses a larger number outright rather than quietly reducing it,
  because clamping would accept one figure and act on another.
- **Finish first** — the action is begun, the pool empties, and what is still
  owed comes out of the next round's pool. That character opens the next round
  whatever their remaining Action Points, because the unfinished action is
  completed before anybody else acts.

Under neither rule does a pool go below zero.

**Every round opens with a fresh roll** (p268, step 1). Each combatant rolls a
new d10 and adds it to their Base Action Points and armour modifier, plus
anything they held over. Points neither spent nor held are lost. The first round
opens the same way as every later one, through the same method, with nothing
carried in.

The rolls are announced to chat as a list of the round's pools, showing the die,
the bonus and any held-over points beneath each total. Deliberately a list
rather than a table: held-over points only exist in some rounds, so a table
gained and lost a column between rounds and the headings were squeezed until
they broke mid-word in the chat sidebar. Without that the
reroll is invisible: a number quietly changing in the tracker is
indistinguishable from a number that did not change at all.

### Not automated

Declaration order. The optional rule on p268 has actions declared from lowest
current AP to highest and then resolved from highest to lowest. Resolution order
is what this implements; declaration is a table convention that needs no
enforcement.

The ten-point cap is advisory rather than enforced. It applies to any one
action, and to movement within a phase, so a character taking two actions in a
phase may legitimately spend more than ten in total — the prompt says so and
lets the number through.

## Non-player characters

NPCs come in two sorts, and the sheet asks which before it shows anything else.

A **person** is built the way a character is: attributes, from which Body,
Fatigue and Action Points follow.

A **creature** is not. The bestiary gives a boar a Body of 57 and a Fatigue of
34 outright and never mentions its Constitution, because those figures were
settled by whoever wrote the table rather than derived from anything. So a
creature states its vitals and the derivation is skipped, and the sheet hides
the attribute grid rather than inviting someone to fill in numbers that mean
nothing.

Two mechanisms make creature stat blocks expressible:

- **A natural attack** carries its own Personal Skill Factor instead of naming a
  combat skill. A boar's tusk is printed as `Med. tusk (36) 16P`, so it rolls at
  Difficulty Factor 3 with 36 as the whole of its PSF, for a 76% chance, and
  deals 16 pierce. It takes no Strength bonus and no Attacker's Bonus: the
  printed figure is the whole of its damage.
- **A skill can state a flat PSF**, replacing attributes, level and category
  entirely. The bestiary gives Dodge, Stamina and Willpower this way.

**Quality and campaign tier** (p513) modify the PSF of every skill and every
Attribute Roll, and stack. Inferior is -2, Superior +2, Exceptional +4. The
rules state only that "an Exceptional Heroic NPC would receive +8% to PSF and
+6% to all AR rolls"; since Exceptional alone is +4 and +4, Heroic contributes
+4 and +2 by subtraction rather than by guesswork. Mythic is never given a
figure anywhere, so it borrows Heroic's rather than inventing one.

**C&S Bestiary** ships with the Boar from p544 as a worked example, complete
with both attacks, its hide and its three skills. The bestiary pages are printed
in landscape with rotated text, so they are not extracted the way the skill,
gear and spell tables are — that is a job of its own, and this one creature was
transcribed by hand to prove the shape.

- **Fourteen weapons weighed nothing.** The weight column is full of vulgar
  fractions and decimals — a knife at a quarter pound, an arrow at a tenth — and
  the integer parser read every one of them as zero, taking them out of the
  encumbrance total entirely. A fraction also sits on a raised baseline, so it
  falls outside its own row's band and was being dropped even before parsing;
  the weight cell is now looked for a few points either side of the row when it
  comes back empty.
- **Ammunition was priced per arrow.** The missile table's footnotes price six
  kinds of ammunition by the score — "Cost is for 20 arrows", and the same for
  bolts and war darts. A physical item now carries a `bundle` saying how many
  pieces its cost covers, and the per-piece cost follows from it, so thirty
  arrows cost one and a half times the printed figure rather than thirty times
  it. The bundle sizes are read out of the footnote text rather than hard-coded
  against a list of names.

  The weight is deliberately left per piece. The footnotes say cost, and nothing
  anywhere says the weight is for twenty as well — a tenth of a pound is about
  right for one arrow and absurd for twenty.

- **The NPC sheet would not open.** ApplicationV2 requires each part to render
  exactly one root element, and the NPC template had nine — a header, some
  sections and a fieldset side by side. The error names the part rather than the
  mistake, which makes it a poor thing to debug twice, so
  `test/templates.test.mjs` now counts the root elements of every template named
  in a PARTS block. It was checked against the broken template before the fix
  went in, and reported nine.

- **Initiative threw on every roll.** No initiative formula was configured, so
  Foundry fell back to its own, which names fields this system does not have.
  It is now a d10 added to Base Action Points and modified for armour, as p268
  gives it, with the modified figure exposed through the actor's roll data.
- **Table - Armour Modifiers (p268) was not implemented.** Wearing nothing gains
  three Action Points a round, light armour is neutral, heavy costs three and
  battle costs five; a character out of Fatigue Points loses a further ten. The
  AP pool is shown on both sheets as the d10 and the modifier it will be added
  to.
- **The vitals band wrapped badly.** Ranging each label alongside its figure
  meant a two-word label such as Base Action Points broke across lines and
  pushed its own value onto another. The labels sit above their figures now, so
  every entry is the same shape however long its name.

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
- **p268 against pp.37-39, the Crit Die overflow.** p268 says to divide the
  excess above Max% by 20 "rounded down". Both worked examples round up: 42%
  over gives +3, and 17% over gives +1, which rounding down would make +2 and
  +0. The examples are followed.
- **p95, roll 100 on the Flaws table.** The row carries the roll and nothing
  else — no name and no cost in its own columns. It is absent from the data
  rather than guessed at, and the test names it so the gap is not mistaken for
  an extraction fault.
- **p95, the 1D10 table.** Rolls 01-05 and 06 print the same text, "Minor Phobia
  & roll again for another flaw", at seven points and thirteen respectively.
  Both ship as printed, told apart by the roll that produces them.
- **p95, two names wrap in the printed table.** Major Phobia breaks across two
  lines and Manic-Depressive across its hyphen. The row grouping had to widen to
  six points to catch the first: the two halves of "Major Phobia" sit four
  tenths of a point apart, and a tighter band split them, putting the second
  half onto the entry above.
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
