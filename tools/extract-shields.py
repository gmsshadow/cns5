"""Table - Shields & Shield Failure (p279).

Nine shields, each with the bonus it gives to a shield block and what it absorbs
of each kind of damage. The absorption table on p260 covers body and head
armour only, so without this a shield block has nothing to block with.

Two rows wrap: "Target Shield - Reinforced" and "Large Shield - Reinforced"
break after the dash, with the last word on the line below.
"""

import collections
import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
PAGE = 278
ROW = 3

# Name, then the block bonus, then the five absorption columns.
BOUNDS = [240, 290, 330, 368, 410, 452]
TYPES = ("slash", "crush", "pierce", "missile", "energy")


def split_row(row):
    cells = [[] for _ in range(len(BOUNDS) + 1)]
    for w in row:
        index = 0
        while index < len(BOUNDS) and w["x0"] >= BOUNDS[index]:
            index += 1
        cells[index].append(w["text"])
    return [" ".join(c).strip() for c in cells]


def extract(pdf):
    page = pdf.pages[PAGE]
    rows = collections.defaultdict(list)
    for w in page.extract_words():
        if 120 <= w["x0"] < 500:
            rows[round(w["top"] / ROW)].append(w)

    shields = []
    for key in sorted(rows):
        row = sorted(rows[key], key=lambda w: w["x0"])
        cells = split_row(row)
        name = re.sub(r"\s+", " ", cells[0]).strip()

        # A name that wrapped after its dash finishes on the following line.
        if name and not cells[1] and shields and shields[-1]["name"].endswith("-"):
            shields[-1]["name"] = f'{shields[-1]["name"]} {name}'.strip()
            continue

        bonus = re.match(r"^\+(\d+)%$", cells[1].strip())
        if not name or not bonus:
            continue

        # A footnote marker follows two of the names.
        name = re.sub(r"(?<=[a-z])\d$", "", name).strip()

        # Any object at hand has its absorption set by the Gamemaster, printed
        # as GM rather than a number. Those stay at zero to be filled in.
        absorption = {}
        for index, damage in enumerate(TYPES):
            cell = cells[2 + index]
            # "GM3" is the word GM with a footnote marker, not a value of three.
            if "GM" in cell:
                absorption[damage] = 0
                continue
            value = re.search(r"\d+", cell)
            absorption[damage] = int(value.group()) if value else 0

        shields.append({
            "name": name,
            "blockBonus": int(bonus.group(1)),
            "absorption": absorption,
            "gamemasterSet": any("GM" in cells[2 + i] for i in range(len(TYPES))),
            "page": PAGE + 1,
        })

    return shields


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        shields = extract(pdf)
    print(f"shields {len(shields)}", file=sys.stderr)
    json.dump(
        {
            "source": "Chivalry & Sorcery 5th Edition core rules, Table - Shields & Shield Failure p279",
            "note": "Mechanical data only. 'Any object at hand' has its absorption set by the Gamemaster at the start of a combat, so its values ship at zero.",
            "count": len(shields),
            "shields": shields,
        },
        sys.stdout,
        indent=2,
        ensure_ascii=False,
    )
