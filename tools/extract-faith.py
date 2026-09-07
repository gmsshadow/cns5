"""Acts of Faith tables of Chivalry & Sorcery 5e (pp.145-146).

Each row gives a minimum Personal Faith Factor, the name of the Act, and a tick
under each vocation that may invoke it. The ticks are Wingdings characters
rather than drawn marks, so they come out of the text layer like anything else.
"""

import collections
import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
PAGES = (144, 145)
# Wingdings: a tick means the vocation may invoke the Act, a cross that it may
# not. Both are printed on every row, which gives a clean integrity check —
# a row that does not carry exactly six marks was read wrongly.
TICK = "\uf0fc"
CROSS = "\uf0fb"
MARKS = (TICK, CROSS)
VOCATIONS = ("Druid", "Shaman", "Witch", "Friar", "Monk", "Ordained")


def columns(page):
    """Locate the vocation columns from the header row."""
    found = {}
    for w in page.extract_words():
        if w["text"] in VOCATIONS and w["text"] not in found:
            found[w["text"]] = w["x0"]
    if len(found) != len(VOCATIONS):
        return None
    xs = [found[v] for v in VOCATIONS]
    # Ticks sit a little right of their heading; bound each column halfway to
    # the next heading, and give the last one the width of its neighbours.
    width = (xs[-1] - xs[0]) / (len(xs) - 1)
    return [(v, xs[i] - 4, xs[i] + width - 4) for i, v in enumerate(VOCATIONS)]


def extract(pdf):
    """Read the Acts of Faith rows.

    Rows are found by their marks rather than their text. Several entries print
    no minimum of their own — Last Rites and the two Anointings sit under
    Extreme Unction's PFF 20 — so a row without one inherits from the row above
    and is flagged, rather than being silently given a number of its own.
    """
    acts = []
    for pno in PAGES:
        page = pdf.pages[pno]
        cols = columns(page)
        if not cols:
            continue

        words = page.extract_words()
        left_edge = min(low for _, low, _ in cols)

        # Group the marks into rows by their baseline.
        mark_rows = collections.defaultdict(list)
        for w in words:
            if any(sym in w["text"] for sym in MARKS):
                mark_rows[round(w["top"])].append(w)

        # Section headings are the text-only lines, in reading order.
        headings = []
        text_rows = collections.defaultdict(list)
        for w in words:
            if not any(sym in w["text"] for sym in MARKS) and w["x0"] < left_edge:
                text_rows[round(w["top"])].append(w)
        for top in sorted(text_rows):
            # A line sharing a baseline with marks is an Act's label, not a
            # heading; only the lines standing alone name a section.
            if any(abs(top - mark_top) <= 7 for mark_top in mark_rows):
                continue
            line = " ".join(x["text"] for x in sorted(text_rows[top], key=lambda w: w["x0"]))
            line = re.sub(r"\s*(Druid|Shaman|Witch|Friar|Monk|Ordained).*$", "", line).strip()
            if not line or line.startswith(("Note", "Table")) or re.match(r"^[\d\u2022]", line):
                continue
            if not re.match(r"^PFF\s+\d", line) and len(line) < 60:
                headings.append((top, line))

        previous_pff = None
        for top in sorted(mark_rows):
            marks = mark_rows[top]

            # Label words share this row's baseline, give or take a point.
            label_words = sorted(
                (w for w in words
                 if w["x0"] < left_edge and abs(w["top"] - top) <= 7
                 and not any(sym in w["text"] for sym in MARKS)),
                key=lambda w: w["x0"],
            )
            label = " ".join(w["text"] for w in label_words).strip()

            pff_match = re.match(r"^PFF\s+(\d+)\s*(.*)$", label)
            if pff_match:
                pff, name, inherited = int(pff_match.group(1)), pff_match.group(2), False
                previous_pff = pff
            else:
                pff, name, inherited = previous_pff, label, True

            name = re.sub(r"\s+", " ", name).strip()
            if not name or pff is None:
                continue

            available, marked = [], 0
            for vocation, low, high in cols:
                mark = next((w for w in marks if low <= w["x0"] < high), None)
                if not mark:
                    continue
                marked += 1
                if TICK in mark["text"]:
                    available.append(vocation)

            section = None
            for heading_top, heading in headings:
                if heading_top <= top:
                    section = heading

            acts.append({
                "name": name,
                "section": section,
                "pffMinimum": pff,
                "pffInherited": inherited,
                "vocations": available,
                "marksFound": marked,
                "page": pno + 1,
            })
    return acts


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        acts = extract(pdf)
    incomplete = [a["name"] for a in acts if a["marksFound"] != len(VOCATIONS)]
    inherited = [a["name"] for a in acts if a["pffInherited"]]
    print(f"acts {len(acts)}", file=sys.stderr)
    print(f"rows without all six marks: {incomplete or 'none'}", file=sys.stderr)
    print(f"rows inheriting a PFF minimum: {inherited or 'none'}", file=sys.stderr)
    json.dump(acts, sys.stdout, indent=2, ensure_ascii=False)
