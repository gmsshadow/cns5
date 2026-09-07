"""Positional parser for the weapon and armour tables of Chivalry & Sorcery 5e.

Weapons: pp.164 (miscellaneous), 255-256 (melee), 257 (missile), 258 (ranges).
Armour:  p.260 (absorption), pp.261-263 (weight, cost and Fatigue to wear).
"""

import collections
import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"

WEAPON_PAGES = (254, 255, 256)      # zero-based
RANGE_PAGE = 257
ABSORPTION_PAGE = 259

ROW = 3                              # points; words within this band share a row

# Weapon type codes and the Attacker's Bonus column each maps to (p255, p282).
# LM and MH are light or medium for Action Point cost but hit as one class
# heavier, and it is the damage class that the Attacker's Bonus keys off.
WEIGHT_CLASS = {
    "L": "light",
    "M": "medium",
    "H": "heavy",
    "2H": "twoHanded",
    "2HS": "twoHanded",
    "LM": "medium",
    "MH": "heavy",
}

DAMAGE_TYPE = {"S": "slash", "C": "crush", "P": "pierce", "M": "missile", "E": "energy"}


def rotated_headers(page):
    """Column headers on these pages are printed sideways and mirrored."""
    rot = [w for w in page.extract_words(extra_attrs=["upright"]) if not w["upright"]]
    cols = collections.defaultdict(list)
    for w in rot:
        cols[round(w["x0"] / 6) * 6].append(w)
    return {
        x: " ".join(p["text"][::-1] for p in sorted(cols[x], key=lambda w: -w["top"]))
        for x in sorted(cols)
    }


def rows_of(page, upright_only=True):
    rows = collections.defaultdict(list)
    for w in page.extract_words(extra_attrs=["upright"]):
        if upright_only and not w["upright"]:
            continue
        rows[round(w["top"] / ROW)].append(w)
    return {k: sorted(v, key=lambda w: w["x0"]) for k, v in sorted(rows.items())}


def boundaries(header_x):
    """Midpoints between adjacent column header positions."""
    xs = sorted(header_x)
    return [(xs[i] + xs[i + 1]) / 2 for i in range(len(xs) - 1)]


def split_row(row, bounds):
    """Bucket a row's words into columns using the boundary list."""
    cells = [[] for _ in range(len(bounds) + 1)]
    for w in row:
        index = 0
        while index < len(bounds) and w["x0"] >= bounds[index]:
            index += 1
        cells[index].append(w["text"])
    return [" ".join(c) for c in cells]


def parse_damage(text):
    """'5S' is 5 points of slashing damage; '10 P' occurs too."""
    m = re.match(r"(\d+)\s*([SCPME])", text.strip().upper())
    if not m:
        return None, None
    return int(m.group(1)), DAMAGE_TYPE[m.group(2)]


def number(text, default=None):
    m = re.search(r"-?\d+", text.replace(",", ""))
    return int(m.group()) if m else default


def extract_weapons(pdf):
    weapons = []
    for pno in WEAPON_PAGES:
        page = pdf.pages[pno]
        headers = rotated_headers(page)
        wanted = [
            "Weapon Type", "Weapon Name", "Date in Use", "Prod time in days",
            "Wt. Lbs", "Length", "Base Damage", "Crit Die Modiifer",
            "Bash Chance", "Cost in Pennies",
        ]
        header_x = {label: x for x, label in headers.items() if label in wanted}
        if len(header_x) != len(wanted):
            continue
        bounds = boundaries(header_x.values())
        left = min(header_x.values())

        group = None
        for row in rows_of(page).values():
            # The legend runs down the far-left margin of p255; skip it.
            row = [w for w in row if w["x0"] >= left - 30]
            if not row:
                continue

            cells = split_row(row, bounds)
            code = cells[0].strip().upper()
            damage, dtype = parse_damage(cells[6])
            # Footnote markers are printed against the name; strip them so the
            # name matches the ranges table and reads properly in the compendium.
            name = re.sub(r"\s+", " ", cells[1]).strip()
            name = re.sub(r"(?<=[a-z\)])[\d,]+$", "", name).strip()

            # A data row fills the date and weight columns; a group heading is a
            # centred name and nothing else. Testing for numbers there does not
            # work: the Elvish Longbow prints a dash for its dates, and several
            # weights are printed as vulgar fractions.
            has_data = bool(cells[2].strip() and cells[4].strip())

            if damage is None and not has_data:
                # A centred name-only row is a group heading.
                if name and not any(cells[i].strip() for i in (0, 3, 4)):
                    group = name
                continue
            # Footnote text sits below the table in the same columns; a real
            # weapon name always begins with a capital.
            if not name or not name[0].isupper():
                continue

            entry = {
                "name": name,
                "group": group,
                "typeCode": code if code in WEIGHT_CLASS else "",
                "weightClass": WEIGHT_CLASS.get(code, "medium"),
                "dates": cells[2].strip(),
                "productionDays": number(cells[3]),
                "weight": number(cells[4], 0),
                "length": cells[5].strip(),
                "critDieModifier": number(cells[7], 0),
                "bash": number(cells[8], 0),
                "cost": number(cells[9]),
                "costNote": cells[9].strip() if number(cells[9]) is None else "",
                "page": pno + 1,
            }

            if damage is not None:
                # A melee weapon: damage carries its type as a letter suffix.
                entry.update({"role": "melee", "baseDamage": damage, "damageType": dtype})
            elif code in WEIGHT_CLASS:
                # Ammunition. The missile table prints damage as a bare number,
                # because a missile is always resisted by the Missile column of
                # the armour table whatever its head is shaped like.
                value = number(cells[6])
                if value is None:
                    continue
                entry.update({"role": "ammunition", "baseDamage": value, "damageType": "missile"})
            else:
                # A launcher. Its Base Damage column holds a bonus added to the
                # missile it looses, not damage the bow itself deals.
                # Crossbows print no bonus at all: the bolt carries the damage.
                entry.update({
                    "role": "launcher",
                    "baseDamage": 0,
                    "damageBonus": number(cells[6], 0),
                    "damageType": "missile",
                })

            weapons.append(entry)
    return weapons


BANDS = ("short", "medium", "long", "extreme", "max")


def extract_ranges(pdf):
    """Table - Missile Ranges (p258).

    Each band has both a distance in feet and its own TSC% modifier, on top of
    the flat band penalty printed above the table. Both are kept.
    """
    page = pdf.pages[RANGE_PAGE]
    out = {}
    # Column boundaries taken from the header row: name, base damage, then a
    # range and modifier pair for each of the five bands.
    # Eleven columns: name, base damage, then a range and modifier pair for
    # each of the five bands.
    bounds = [168, 210, 248, 273, 305, 331, 360, 387, 420, 448, 478]

    for row in rows_of(page).values():
        cells = split_row([w for w in row if w["x0"] >= 80], bounds)
        name = re.sub(r"\s+", " ", cells[0]).strip()
        if not name or name.lower().startswith(("weapon", "tsc", "short")):
            continue

        distances, modifiers = {}, {}
        ok = True
        for index, band in enumerate(BANDS):
            distance = number(cells[2 + index * 2])
            modifier = number(cells[3 + index * 2])
            if distance is None or modifier is None:
                ok = False
                break
            distances[band] = distance
            modifiers[band] = modifier
        if not ok:
            continue

        out[name.lower()] = {"ranges": distances, "rangeModifiers": modifiers,
                             "baseDamage": number(cells[1])}
    return out


def extract_armour(pdf):
    """Table - Armour Absorption (p260)."""
    page = pdf.pages[ABSORPTION_PAGE]
    armour = []
    section = None
    # Fixed columns, read off the header row rather than rotated labels.
    bounds = [313, 360, 395, 433, 473, 513]

    for row in rows_of(page).values():
        row = [w for w in row if w["x0"] >= 210]        # skip the left-hand prose column
        if not row:
            continue
        cells = split_row(row, [b - 210 + 210 for b in bounds])
        name = re.sub(r"\s+", " ", cells[0]).strip()

        if "Armour" in name and "Weight" in " ".join(cells[1:2] + [cells[1]]):
            section = "head" if name.startswith("Head") else "body"
            continue
        if cells[1].strip() in ("Weight",):
            section = "head" if name.startswith("Head") else "body"
            continue

        values = [number(c) for c in cells[2:7]]
        if not name or any(v is None for v in values):
            continue

        weight = re.sub(r"\d", "", cells[1]).strip().lower() or "none"
        armour.append({
            "name": name,
            "location": section or "body",
            "weightClass": weight,
            "absorption": dict(zip(("slash", "crush", "pierce", "missile", "energy"), values)),
            "page": ABSORPTION_PAGE + 1,
        })
    return armour


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        weapons = extract_weapons(pdf)
        ranges = extract_ranges(pdf)
        armour = extract_armour(pdf)

    # The ranges table abbreviates: 'mdm. crossbow', 'ap arrow', 'composite.
    # bow'. Normalise both sides and expand the abbreviations rather than
    # fuzzy-matching, which could pair the wrong weapon with the wrong ranges.
    ABBREVIATIONS = {
        "mdm": "medium",
        "ap": "armour piercing",
        "shepherds sling": "shepherds",
        "thrown knife": "throwing knives",
        "thrown axe": "throwing axe",
        "pilum": "roman pilum",
    }

    def normalise(name):
        key = re.sub(r"[^a-z0-9 ]", "", name.lower()).strip()
        key = ABBREVIATIONS.get(key, key)
        key = " ".join(ABBREVIATIONS.get(part, part) for part in key.split())
        # Trailing plurals differ between the two tables ('War Arrow' against
        # 'War Arrows'), but only strip one where a word precedes it.
        return re.sub(r"(?<=\w\w\w)s$", "", key)

    lookup = {normalise(k): v for k, v in ranges.items()}

    matched = []
    for w in weapons:
        band = lookup.get(normalise(w["name"]))
        if not band:
            continue
        matched.append(w["name"])
        w["missile"] = True
        w["ranges"] = band["ranges"]
        w["rangeModifiers"] = band["rangeModifiers"]

    unmatched = sorted(set(ranges) - {normalise(m) for m in matched} -
                       {k for k in lookup if k in {normalise(m) for m in matched}})
    print(f"ranges matched onto {len(matched)} weapons", file=sys.stderr)
    leftover = [k for k in ranges if normalise(k) not in {normalise(m) for m in matched}]
    if leftover:
        print(f"range rows with no weapon: {leftover}", file=sys.stderr)
    print(f"weapons {len(weapons)}  ranges {len(ranges)}  armour {len(armour)}", file=sys.stderr)
    json.dump({"weapons": weapons, "armour": armour}, sys.stdout, indent=2, ensure_ascii=False)
