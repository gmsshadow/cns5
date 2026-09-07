"""Positional parser for the weapon and armour tables of Chivalry & Sorcery 5e.

Weapons: pp.164 (miscellaneous), 255-256 (melee), 257 (missile), 258 (ranges).
Armour:  p.260 (absorption by type), pp.261-263 (pieces, with weight, cost and
         Fatigue cost to wear).
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




# page index, vertical band, horizontal band, column header positions, whether a
# Fatigue-to-wear and a weight-modifier column are present, and where it is worn.
PIECE_TABLES = [
    dict(page=260, top=280, bottom=470, left=70, right=385,
         cols=[78, 132, 216, 258, 288, 330, 354],
         fields=["type", "name", "dates", "fp", "production", "weight", "cost"],
         location="head"),
    dict(page=260, top=586, bottom=720, left=320, right=575,
         cols=[354, 414, 450, 486, 504, 546],
         fields=["name", "fp", "production", "weight", "cost", "weightMod"],
         location="body"),
    dict(page=261, top=262, bottom=400, left=300, right=560,
         cols=[336, 390, 432, 468, 486, 522],
         fields=["name", "fp", "production", "weight", "cost", "weightMod"],
         location="body"),
    dict(page=262, top=108, bottom=200, left=320, right=575,
         cols=[354, 408, 444, 474, 504, 540],
         fields=["name", "fp", "production", "weight", "cost", "weightMod"],
         location="body"),
    dict(page=262, top=218, bottom=400, left=70, right=320,
         cols=[96, 162, 204, 240, 258, 294],
         fields=["name", "fp", "production", "weight", "cost", "weightMod"],
         location="body"),
    dict(page=262, top=485, bottom=580, left=70, right=320,
         cols=[84, 156, 186, 222, 252, 288],
         fields=["name", "fp", "production", "weight", "cost", "weightMod"],
         location="body"),
]

FRACTIONS = {"½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3}


def words_in(page, spec):
    return [
        w for w in page.extract_words(extra_attrs=["upright"])
        if w["upright"]
        and spec["top"] <= w["top"] <= spec["bottom"]
        and spec["left"] <= w["x0"] <= spec["right"]
    ]


def find_fatigue(words, spec, row_top):
    """Find the Fatigue-to-wear cell for a row.

    Its baseline is raised where a superscript footnote follows it, so it can
    fall a few points above the rest of the row and miss the row bucket. Search
    a small window around the row instead of relying on exact alignment.
    """
    if "fp" not in spec["fields"]:
        return None
    index = spec["fields"].index("fp")
    cols = spec["cols"]
    low = (cols[index - 1] + cols[index]) / 2 if index else spec["left"]
    high = (cols[index] + cols[index + 1]) / 2 if index + 1 < len(cols) else spec["right"]

    for w in words:
        if low <= w["x0"] < high and abs(w["top"] - row_top) <= 9:
            value = fatigue(w["text"])
            if value is not None:
                return value
    return None


def piece_rows(page, spec):
    rows = collections.defaultdict(list)
    for w in page.extract_words(extra_attrs=["upright"]):
        if not w["upright"]:
            continue
        if not (spec["top"] <= w["top"] <= spec["bottom"]):
            continue
        if not (spec["left"] <= w["x0"] <= spec["right"]):
            continue
        rows[round(w["top"] / 3)].append(w)
    return [sorted(v, key=lambda w: w["x0"]) for _, v in sorted(rows.items())]


def split_piece_row(row, cols):
    bounds = [(cols[i] + cols[i + 1]) / 2 for i in range(len(cols) - 1)]
    cells = [[] for _ in cols]
    for w in row:
        index = 0
        while index < len(bounds) and w["x0"] >= bounds[index]:
            index += 1
        cells[index].append(w["text"])
    return [" ".join(c) for c in cells]


def quantity(text):
    """Parse '5', '5½', '3 ½' and '1,536' into a number."""
    text = text.replace(",", "").strip()
    if not text:
        return None
    total = 0.0
    found = False
    for m in re.finditer(r"\d+(?:\.\d+)?", text):
        total += float(m.group())
        found = True
    for glyph, value in FRACTIONS.items():
        if glyph in text:
            total += value
            found = True
    return round(total, 2) if found else None


def fatigue(text):
    """Fatigue to wear runs 0 to -5; a trailing digit is a footnote marker."""
    m = re.match(r"\s*(-?\d)", text.strip())
    return int(m.group(1)) if m else None


def weight_modifier(text):
    m = re.search(r"(\d+(?:\.\d+)?)", text.replace(",", ""))
    return float(m.group(1)) if m else None


def extract_armour_pieces(pdf):
    pieces = []
    for spec in PIECE_TABLES:
        page = pdf.pages[spec["page"]]
        words = words_in(page, spec)
        for row in piece_rows(page, spec):
            cells = dict(zip(spec["fields"], split_piece_row(row, spec["cols"])))
            name = re.sub(r"\s+", " ", cells.get("name", "")).strip()
            name = re.sub(r"(?<=[a-z\)])\d+$", "", name).strip()

            weight = quantity(cells.get("weight", ""))
            cost = quantity(cells.get("cost", ""))
            if not name or weight is None or cost is None:
                continue
            if not name[0].isupper():
                continue

            # The book prints these as negatives for heavier armour but gives
            # the Cuirbolli Cuirass a bare "1". Every value is a cost either
            # way, so the magnitude is stored and the sign discarded.
            fp = find_fatigue(words, spec, row[0]["top"])
            if fp is None:
                fp = fatigue(cells.get("fp", ""))

            pieces.append({
                "name": name,
                "location": spec["location"],
                "fpToWear": abs(fp) if fp is not None else 0,
                "weight": weight,
                "cost": int(cost),
                # A cost printed with a trailing '+' means "at least this".
                "costAtLeast": "+" in cells.get("cost", ""),
                "weightModifier": weight_modifier(cells.get("weightMod", "")) or 0,
                "dates": cells.get("dates", "").strip(),
                "page": spec["page"] + 1,
            })
    return pieces



if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        weapons = extract_weapons(pdf)
        ranges = extract_ranges(pdf)
        armour = extract_armour(pdf)
        pieces = extract_armour_pieces(pdf)

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
    print(f"armour pieces {len(pieces)}", file=sys.stderr)
    json.dump({"weapons": weapons, "armour": armour, "armourPieces": pieces},
              sys.stdout, indent=2, ensure_ascii=False)
