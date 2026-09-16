"""Table - Missile Ranges and Table - Ranged Strength Modifier (p258).

The ranges table is not a list of weapons. Each row is a *pairing* — a bow with
a particular kind of arrow, or a thrown weapon with itself — and the figures
belong to the pairing rather than to either part of it. A longbow shooting war
arrows reaches 600 feet at extreme range; the same bow with armour-piercing
arrows reaches 450. Neither number is a property of the bow.

Each row gives the pairing's composite base damage and five range brackets, each
with a distance and a Crit Die modifier of its own.

Rows naming a kind of ammunition belong to the launcher above them. Everything
else opens a new pairing: a launcher with whatever it is ordinarily loaded with,
or a weapon that is thrown and so is its own ammunition.
"""

import collections
import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
PAGE = 257
ROW = 3
BANDS = ("short", "medium", "long", "extreme", "max")

# Name, base damage, then a distance and a Crit Die modifier for each band:
# twelve columns, so eleven boundaries between them.
BOUNDS = [180, 205, 240, 268, 295, 322, 350, 377, 408, 438, 470]

# A row naming one of these is the launcher above it loaded differently.
AMMUNITION = re.compile(r"^(War Arrows?|AP Arrows?|Lead Bullets)$", re.I)

# What a launcher is loaded with when the table names nothing else.
DEFAULT_AMMUNITION = {
    "Short Bow": "Hunting Arrows",
    "Composite. Bow": "Hunting Arrows",
    "Longbow": "Hunting Arrows",
    "Elvish Longbow": "Hunting Arrows",
    "Light Crossbow": "Light Crossbow Bolts",
    "Mdm. Crossbow": "Medium Crossbow Bolts",
    "Heavy Crossbow": "Heavy Crossbow Bolts",
    "Shepherd's Sling": "Sling stones",
    "Slingstaff": "Sling stones",
}

# Weapons that are their own ammunition.
THROWN = {"Dart", "Hunting Javelin", "War Javelin", "Pilum", "Thrown Axe", "Thrown Knife"}


def rows_of(page, x_min, x_max, y_min=0, y_max=10_000):
    rows = collections.defaultdict(list)
    for w in page.extract_words():
        if x_min <= w["x0"] < x_max and y_min <= w["top"] < y_max:
            rows[round(w["top"] / ROW)].append(w)
    return [sorted(v, key=lambda w: w["x0"]) for _, v in sorted(rows.items())]


def split_row(row, bounds):
    cells = [[] for _ in range(len(bounds) + 1)]
    for w in row:
        index = 0
        while index < len(bounds) and w["x0"] >= bounds[index]:
            index += 1
        cells[index].append(w["text"])
    return [" ".join(c).strip() for c in cells]


def number(text):
    m = re.search(r"-?[\d,]+", text or "")
    return int(m.group().replace(",", "")) if m else None


def extract_profiles(pdf):
    page = pdf.pages[PAGE]
    profiles = []
    launcher = None

    # The ranges table occupies the upper half of the page; the strength table
    # sits below it and shares the same columns of the page.
    for row in rows_of(page, 80, 500, 0, 520):
        cells = split_row(row, BOUNDS)
        name = re.sub(r"\s+", " ", cells[0]).strip()
        damage = number(cells[1])

        if not name or damage is None:
            continue
        if name.lower().startswith(("weapon", "table", "this is")):
            continue

        distances, modifiers = {}, {}
        complete = True
        for index, band in enumerate(BANDS):
            distance = number(cells[2 + index * 2])
            modifier = number(cells[3 + index * 2])
            if distance is None or modifier is None:
                complete = False
                break
            distances[band] = distance
            modifiers[band] = modifier
        if not complete:
            continue

        if AMMUNITION.match(name) and launcher:
            # The launcher above, loaded with something else.
            ammunition = name
        elif name in THROWN:
            launcher, ammunition = None, None
        else:
            launcher = name
            ammunition = DEFAULT_AMMUNITION.get(name)

        profiles.append({
            "weapon": name if launcher is None else launcher,
            "ammunition": ammunition,
            "thrown": launcher is None,
            "baseDamage": damage,
            "ranges": distances,
            "critModifiers": modifiers,
            "page": PAGE + 1,
        })

    return profiles


def extract_range_penalties(pdf):
    """The TSC% Modifier row above Table - Missile Ranges (p258).

    It sits above the band names rather than among the columns, which is how it
    came to be missed: the table proper was read from the row of headings
    downwards, and this line is above them. Shooting further is harder, and
    without it every shot was made at its short-range chance however far away
    the target stood.
    """
    page = pdf.pages[PAGE]
    for row in rows_of(page, 60, 520, 0, 100):
        text = " ".join(w["text"] for w in row)
        if "TSC%" not in text:
            continue

        values = [int(m) for m in re.findall(r"(-?\d+)%", text)]
        if len(values) == len(BANDS):
            return dict(zip(BANDS, values))
    return {}


def extract_strength_modifiers(pdf):
    """Table - Ranged Strength Modifier to Crit Die (p258).

    A character of Strength 12 or better shoots harder, and the table says by
    how much for each kind of missile at each range.
    """
    page = pdf.pages[PAGE]
    out = []
    for row in rows_of(page, 270, 500, 520, 720):
        cells = split_row(row, [360, 385, 412, 440, 468])
        name = re.sub(r"\s+", " ", cells[0]).strip()
        values = [number(c) for c in cells[1:6]]

        if not name or any(v is None for v in values):
            continue
        if name.lower().startswith(("name", "table")):
            continue

        out.append({"ammunition": name, "modifiers": dict(zip(BANDS, values))})
    return out


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        profiles = extract_profiles(pdf)
        strength = extract_strength_modifiers(pdf)
        penalties = extract_range_penalties(pdf)

    print(f"profiles {len(profiles)}  strength rows {len(strength)}  "
          f"range penalties {penalties}", file=sys.stderr)
    json.dump(
        {
            "source": "Chivalry & Sorcery 5th Edition core rules, Table - Missile Ranges and "
                      "Table - Ranged Strength Modifier to Crit Die, p258",
            "note": "Each profile is a launcher paired with a kind of ammunition, or a thrown "
                    "weapon which is its own. The base damage is the pair's together.",
            "profileCount": len(profiles),
            "profiles": profiles,
            "strengthModifiers": strength,
            "rangePenalties": penalties,
        },
        sys.stdout,
        indent=2,
        ensure_ascii=False,
    )
