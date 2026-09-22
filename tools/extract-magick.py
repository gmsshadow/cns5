"""The tables governing spell targeting (pp.296-298).

Casting a spell and targeting it are separate acts. Casting makes the pattern;
targeting carries it to where it is wanted, and that is what these tables
modify. A caster's Mode of Magick chance is reduced by the target's own
resistance, by how either of them is moving, by whatever stands between them,
and by the distance.

Three tables:

  - Target's Magick Resistance, by what the target is. A Lich resists forty per
    cent where a human resists nothing.
  - Targeting Movement Penalty, which is as often a bonus: a target standing
    still and in plain view is easier to hit.
  - Targeting Modifiers for Obstacles, ending in True Lead, through which no
    spell passes at all.
"""

import collections
import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
ROW = 3


def rows_of(page, x_min=0, x_max=10_000, y_min=0, y_max=10_000):
    rows = collections.defaultdict(list)
    for w in page.extract_words():
        if x_min <= w["x0"] < x_max and y_min <= w["top"] < y_max:
            rows[round(w["top"] / ROW)].append(w)
    return [sorted(v, key=lambda w: w["x0"]) for _, v in sorted(rows.items())]


def extract_resistance(pdf):
    """Table - Target's Magick Resistance (p297), printed as two pairs of columns."""
    page = pdf.pages[296]
    out = {}
    for row in rows_of(page, 330, 580):
        text = " ".join(w["text"] for w in row)
        if "Table" in text or "MR" == text.strip():
            continue
        # Each line holds up to two name-and-number pairs.
        for name, value in re.findall(r"([A-Za-z][A-Za-z,\-' ]+?)\s+(\d{1,2})(?=\s|$)", text):
            cleaned = name.strip()
            # The movement table sits directly below and its rows read like
            # entries here; nothing in this table is a sentence about moving.
            if cleaned.lower().startswith(("caster is", "target is", "target ")):
                continue
            if cleaned and cleaned.lower() not in ("target", "target mr"):
                out[cleaned] = int(value)
    return out


# Table - Targeting Movement Penalty (p297) and Table - Targeting Modifiers for
# Obstacles (p298), transcribed rather than parsed.
#
# Both are narrow tables set in a column beside running prose, and the words of
# one interleave with the words of the other on every line a parser can see. An
# attempt at reading them positionally produced entries like "harmful ice, rock
# or metal Target behind wall of lead", which is two tables and a sentence of
# prose in one label. Fourteen rows between them did not justify the machinery
# it would have taken to separate them reliably.
MOVEMENT = [
    {"id": "casterMoving", "label": "Caster is moving faster than 10 feet per turn", "modifier": -10},
    {"id": "targetStill", "label": "Target is stationary and in view", "modifier": 10},
    {"id": "targetMoving30", "label": "Target is moving faster than 30 feet per turn", "modifier": -5},
    {"id": "targetMoving100", "label": "Target is moving faster than 100 feet per turn", "modifier": -15},
    {"id": "targetAdvancing", "label": "Target is advancing toward spell caster", "modifier": 10},
]

OBSTACLES = [
    {"id": "invisible", "label": "Target invisible but generally located", "modifier": -25},
    {"id": "foliage", "label": "Target obscured by foliage or partial cover", "modifier": -10},
    {"id": "reflection", "label": "Target seen in a mirror or pond reflection", "modifier": -10},
    {"id": "dust", "label": "Target behind wall of dust, spray, fog, fire, light or darkness",
     "modifier": -15},
    {"id": "water", "label": "Target behind wall of water, ice, rock or metal", "modifier": -20},
    {"id": "lead", "label": "Target behind wall of lead", "modifier": -25},
    # Not a penalty but a wall: no spell passes it at all.
    {"id": "trueLead", "label": "Target behind wall of True Lead", "modifier": None,
     "impenetrable": True},
    {"id": "dwarvish", "label": "Target clad in full armour of Dwarvish Steel", "modifier": -10},
    {"id": "enchantedDwarvish",
     "label": "Target clad in full armour of Enchanted Dwarvish Steel", "modifier": -20},
    {"id": "scried", "label": "Target by Astrology, Divination or a scrying device", "modifier": -20},
]


def extract_learning_modifiers(pdf):
    """Table - Spell Magick Resistance Modifiers (p295).

    Thirteen Methods of Magick down the side against fourteen Modes across the
    top, each cell a modifier to a spell's Magick Resistance when a mage of that
    tradition learns a spell of that school. A positive figure raises the spell's
    Magick Resistance and so the time it takes: commands come readily to a
    Necromancer and hard to a Conjurer, which at Magick Level 5 is the
    difference between three days and eighty-four.

    The column headings are set rotated, and pdfplumber reads a rotated word
    back to front, so they are reversed before use.
    """
    page = pdf.pages[294]

    columns = collections.defaultdict(list)
    for w in page.extract_words(extra_attrs=["upright"]):
        # The leftmost rotated label is the table's own title rather than a
        # Mode. Bounded by position, since the book misspells "Modifier" there
        # and a match on the word misses it.
        if not w["upright"] and w["x0"] >= 190:
            columns[round(w["x0"] / 6) * 6].append(w)

    modes = {}
    for x, parts in columns.items():
        label = " ".join(
            p["text"][::-1] for p in sorted(parts, key=lambda w: -w["top"])
        ).strip()
        if label:
            modes[x] = label

    order = [modes[x] for x in sorted(modes)]

    rows = collections.defaultdict(list)
    for w in page.extract_words():
        rows[round(w["top"] / ROW)].append(w)

    table = {}
    for key in sorted(rows):
        row = sorted(rows[key], key=lambda w: w["x0"])
        values = [w for w in row if re.fullmatch(r"[+-]?\d", w["text"])]
        if len(values) != len(order):
            continue

        name = " ".join(w["text"] for w in row if w["x0"] < 195).strip()
        if not name:
            continue

        # The four elements are printed as one Method over four rows, only the
        # first carrying the family name. They are separate skills, so each is
        # given its own.
        if name in ("Earth", "Fire", "Water"):
            name = f"Basic Magick {name}"

        table[name] = {mode: int(v["text"]) for mode, v in zip(order, values)}

    return {"modes": order, "modifiers": table}


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        resistance = extract_resistance(pdf)
        learning = extract_learning_modifiers(pdf)
    movement, obstacles = MOVEMENT, OBSTACLES

    print(f"resistance {len(resistance)}  movement {len(movement)}  "
          f"obstacles {len(obstacles)}  learning {len(learning['modifiers'])} methods "
          f"x {len(learning['modes'])} modes", file=sys.stderr)

    json.dump(
        {
            "source": "Chivalry & Sorcery 5th Edition core rules, pp.296-298",
            "note": "Targeting modifiers only. A target's Magick Resistance is subtracted "
                    "from the caster's Mode of Magick chance; the others are added as printed.",
            "targetResistance": resistance,
            "movement": movement,
            "obstacles": obstacles,
            "learningModes": learning["modes"],
            "learningModifiers": learning["modifiers"],
        },
        sys.stdout,
        indent=2,
        ensure_ascii=False,
    )
