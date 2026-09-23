"""Table - Curses and Table - Allergies (pp.85-87).

"Step 8 - The 'Curse'": a character may begin play under a curse, rolled on a
d100, and some curses are allergies, rolled again on a d10.

Each row of the table opens with its range — "01 - 04" — at the left margin,
and runs on over as many lines as its description needs. So a row is gathered
from one range to the next.

What is kept is the range, the page it is printed on, and a short name from
tools/curse-labels.json so that one entry can be told from another. What a
curse does is the rulebook's and is not shipped, in its wording or in ours.
"""

import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
RANGE = re.compile(r"^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s+(.*)$")

# Every page of the PDF carries a footer with its number and the purchaser's
# name and order. A row broken across a page picked it up as though it were
# part of the description, so it is taken out wherever it appears: it belongs
# to one copy of the book, not to the rules.
FOOTER = re.compile(r"\s*\b\d{1,3}\s+[A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+)*\s+\(Order #\d+\)")


def rows_from(pdf, pages, stop_words=()):
    rows, current = [], None
    for pno in pages:
        text = pdf.pages[pno - 1].extract_text() or ""
        for raw in text.split("\n"):
            line = raw.strip()
            if not line or line.startswith(("1D100", "1D10", "Table", "Curse lying")):
                continue
            if any(word in line for word in stop_words):
                continue
            m = RANGE.match(line)
            # A new row is a range at the start of a line followed by words;
            # a page number or a stray figure is not.
            if m and m.group(3) and m.group(3)[0].isalpha():
                if current:
                    rows.append(current)
                low = int(m.group(1))
                current = {
                    "min": low,
                    "max": int(m.group(2)) if m.group(2) else low,
                    "text": m.group(3),
                    "page": pno,
                }
            elif current:
                current["text"] += " " + line
    if current:
        rows.append(current)
    return rows


def rows_by_position(pdf, pno, low, high):
    """A table whose ranges sit vertically centred in their rows.

    Table - Allergies prints each range beside the middle of its description,
    so some of a row's lines come before its range and some after. Reading in
    order would give each range the tail of the row above. Instead each line of
    description goes to the range nearest it on the page.
    """
    page = pdf.pages[pno - 1]
    words = page.extract_words()

    # The ranges down the left, where nothing else starts.
    left = min(w["x0"] for w in words if re.fullmatch(r"\d{2}", w["text"]))
    ranges = []
    lines = {}
    for w in words:
        key = round(w["top"])
        lines.setdefault(key, []).append(w)

    for top, line in sorted(lines.items()):
        line.sort(key=lambda w: w["x0"])
        first = line[0]
        # A single-number row ("09") is centred under the two-number ones
        # ("01 - 02"), so it starts a little further right than they do.
        if 0 <= first["x0"] - left < 12 and re.fullmatch(r"\d{2}", first["text"]):
            label = " ".join(w["text"] for w in line[:3])
            m = re.match(r"(\d{2})(?:\s*-\s*(\d{2}))?", label)
            ranges.append({"min": int(m.group(1)), "max": int(m.group(2) or m.group(1)),
                           "top": top, "lines": []})

    ranges = [r for r in ranges if low <= r["min"] <= high]
    for top, line in sorted(lines.items()):
        body = [w for w in line if w["x0"] > left + 30]
        if not body or not ranges:
            continue
        text = " ".join(w["text"] for w in body)
        if text.startswith(("Table", "Step", "1D10")) or text == "Allergy":
            continue
        # Only lines within the table's own span.
        if top < ranges[0]["top"] - 30 or top > ranges[-1]["top"] + 30:
            continue
        nearest = min(ranges, key=lambda r: abs(r["top"] - top))
        nearest["lines"].append((top, text))

    out = []
    for r in ranges:
        out.append({
            "min": r["min"], "max": r["max"], "page": pno,
            "text": " ".join(t for _, t in sorted(r["lines"]))
        })
    return out


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        curses = rows_from(pdf, (85, 86), stop_words=("Allergy",))
        allergies = rows_by_position(pdf, 87, 1, 10)

    for row in curses + allergies:
        row["text"] = FOOTER.sub("", row["text"]).strip()

    # Three ranges carry a footnote marker stuck to their end — "51 - 601" is
    # 51 to 60 and footnote 1 — and the last row runs on into the footnote's
    # own text. Both are taken off.
    for row in curses:
        if row["max"] > 100:
            row["max"] = int(str(row["max"])[:-1])
            row["footnote"] = 1
        row["text"] = re.split(r"\s1An allergy", row["text"])[0].strip()

    # The names and notes are the system's own, kept apart from this script so
    # they can be corrected without re-reading the book.
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    labels = json.load(open(os.path.join(here, "curse-labels.json"), encoding="utf-8"))

    def finish(rows, table, die):
        out, missing = [], []
        for row in rows:
            key = f"{row['min']}-{row['max']}"
            label = labels[table].get(key)
            if not label:
                missing.append(key)
                continue
            text = row.pop("text")
            # What a curse *does* is the rulebook's, and is not shipped — not
            # in its own words nor in ours. What ships is where to find it: a
            # name to tell it from its neighbours, the roll that produces it,
            # and the page it is described on. The figures pulled out of the
            # prose went the same way, being fragments of a description and
            # meaningless without it.
            out.append({
                "name": label,
                "roll": [row["min"], row["max"]],
                "die": die,
                "page": row["page"],
                # A curse that sends the roller to another table: Allergies,
                # Phobias, or Curses itself again.
                "rollsOnAnotherTable": bool(re.search(r"Roll (twice|three times|against|on)|See Table", text)),
            })
        if missing:
            print(f"  no label for {table} {missing}", file=sys.stderr)
        return out

    curses = finish(curses, "curses", "1d100")
    allergies = finish(allergies, "allergies", "1d10")

    print(f"curses {len(curses)}  allergies {len(allergies)}", file=sys.stderr)
    json.dump(
        {
            "source": "Chivalry & Sorcery 5th Edition core rules, Table - Curses (pp.85-86) "
                      "and Table - Allergies (p87)",
            "note": "Rolls, pages and names only. The names are this system's own, from "
                    "tools/curse-labels.json. Nothing of what a curse does is shipped: "
                    "see the page given on each entry.",
            "curses": curses,
            "allergies": allergies,
        },
        sys.stdout,
        indent=2,
        ensure_ascii=False,
    )
