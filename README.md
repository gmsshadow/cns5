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

## Damage

A landed blow is the weapon's damage, the Strength bonus, the Attacker's Bonus
and the Crit Die. Armour covering that damage type absorbs what it can, and what
gets through comes off Fatigue Points until they are gone and off Body
thereafter.

A Critical Success adds a further d10, and that die behaves quite differently:
it "is directly removed from the target's Body", ignoring the armour and
whatever Fatigue the target has left. **That is the whole of what a critical
bypasses.** The rest of the blow is absorbed and soaked up as usual — a common
misreading, and the worked example on p287 settles it.

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
