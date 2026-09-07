"""Spell tables of Chivalry & Sorcery 5e (pp.309-358).

A single table, repeated across eighteen pages with its header on each, giving
every spell's Magick Resistance cost, Fatigue cost, casting time, range,
duration, description page and prerequisite.

Some entries are variants of the spell above them — Acrid Smoke and Sulphurous
Fumes both belong to Create Noxious Fumes — and print only the columns that
differ. They are emitted as spells in their own right, since that is how they
are cast, with the parent recorded.
"""

import collections
import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
HEADERS = ["Spell", "MR", "Fat", "Casting", "Rng", "Dur", "Page", "Prerequisite"]
FIELDS = ["name", "mr", "fatigue", "casting", "range", "duration", "page", "prerequisite"]
ROW = 3


def header_columns(page):
    """The header repeats on every table page; its positions give the columns."""
    found = {}
    for w in page.extract_words():
        if w["text"] in HEADERS and w["text"] not in found and w["top"] < 120:
            found[w["text"]] = w["x0"]
    if len(found) != len(HEADERS):
        return None
    return [found[h] for h in HEADERS]


def boundaries(cols):
    """Names are right-aligned into their column, so the first boundary sits
    just left of the MR column rather than halfway to it."""
    bounds = [cols[1] - 8]
    bounds += [(cols[i] + cols[i + 1]) / 2 for i in range(1, len(cols) - 1)]
    return bounds


def split_row(row, bounds):
    cells = [[] for _ in range(len(bounds) + 1)]
    for w in row:
        index = 0
        while index < len(bounds) and w["x0"] >= bounds[index]:
            index += 1
        cells[index].append(w["text"])
    return [re.sub(r"\s+", " ", " ".join(c)).strip() for c in cells]


def extract(pdf):
    spells = []
    # Sections and variant parents both run on across page breaks: the heading
    # is printed once, above whichever page the group happens to start on.
    section = None
    parent = None
    for pno in range(300, 370):
        page = pdf.pages[pno]
        cols = header_columns(page)
        if not cols:
            continue
        bounds = boundaries(cols)

        rows = collections.defaultdict(list)
        for w in page.extract_words():
            rows[round(w["top"] / ROW)].append(w)

        for key in sorted(rows):
            row = sorted(rows[key], key=lambda w: w["x0"])
            cells = dict(zip(FIELDS, split_row(row, bounds)))

            if cells["name"] == "Spell" and cells["mr"] == "MR":
                continue

            # A long duration can overrun into the Page column — "2 min + 15
            # seconds x ML" pushes its trailing ML past the boundary. Take the
            # page reference off the end and give the rest back to duration.
            page_ref = re.search(r"(\d{3})\s*$", cells["page"])
            if page_ref:
                spill = cells["page"][: page_ref.start()].strip()
                if spill:
                    cells["duration"] = f'{cells["duration"]} {spill}'.strip()
            if not page_ref:
                text = " ".join(w["text"] for w in row).strip()
                if not text or re.search(r"\d{3}", text) or len(text) >= 60:
                    continue
                if text.startswith(("Barry", "Table")) or text.isdigit():
                    continue

                # A line lying wholly inside the Spell column is the tail of a
                # name that wrapped — "The Seal of Suleiman the Magnificent"
                # breaks across two lines. Section headings are centred over the
                # table and so sit right of the Spell column.
                if spells and all(w["x0"] < bounds[0] for w in row):
                    spells[-1]["name"] = f'{spells[-1]["name"]} {text}'
                    if parent == spells[-1]["name"].rsplit(" ", 1)[0]:
                        parent = spells[-1]["name"]
                else:
                    section = text
                    parent = None
                continue

            name = cells["name"]
            if not name:
                continue

            # A row with no MR and no casting time is either a variant of the
            # spell above it, printing only what differs, or an entry the book
            # left blank. Only the first has something of its own to say.
            bare = not cells["mr"] and not cells["casting"]
            differs = any(cells[f] for f in ("fatigue", "range", "duration"))
            variant = bare and differs
            incomplete = bare and not differs

            spells.append({
                "name": name,
                "section": section,
                "parent": parent if variant else None,
                "incomplete": incomplete,
                "mr": cells["mr"] or None,
                "fatigue": cells["fatigue"] or None,
                "casting": cells["casting"] or None,
                "range": cells["range"] or None,
                "duration": cells["duration"] or None,
                "reference": int(page_ref.group(1)),
                "prerequisite": cells["prerequisite"] or None,
                "page": pno + 1,
            })
            if not bare:
                parent = name
    return spells


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        spells = extract(pdf)
    variants = sum(1 for s in spells if s["parent"])
    incomplete = [s["name"] for s in spells if s["incomplete"]]
    print(f"spells {len(spells)} ({variants} variants) "
          f"across {len({s['section'] for s in spells})} sections", file=sys.stderr)
    print(f"entries the table leaves blank: {incomplete or 'none'}", file=sys.stderr)
    json.dump(spells, sys.stdout, indent=2, ensure_ascii=False)
