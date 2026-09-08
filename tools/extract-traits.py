"""Special Abilities & Talents, Deficiencies & Defects, and Phobias (pp.88-97).

Three tables, all rolled on 1D100. Only the tables are read: the descriptions
on pp.89-94 are prose and stay in the book.

  - Special Abilities & Talents (p88) — a PC Point cost apiece. Some are marked
    (w) for Well Aspected characters only, and some can be had by a random roll
    alone rather than bought.
  - Deficiencies & Defects (p95) — printed in two columns side by side. These
    grant PC Points rather than costing them.
  - Phobias (pp.96-97) — each naming the fear it is.
"""

import collections
import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
ROW = 3


def rows_of(page, x_min=0, x_max=10_000):
    rows = collections.defaultdict(list)
    for w in page.extract_words():
        if x_min <= w["x0"] < x_max:
            rows[round(w["top"] / ROW)].append(w)
    return [sorted(v, key=lambda w: w["x0"]) for _, v in sorted(rows.items())]


def leading_range(row, limit):
    """Read the percentile span from the words left of `limit`.

    Printed as "01 - 02" across three words, or as a single number where the
    entry covers one result only.
    """
    text = " ".join(w["text"] for w in row if w["x0"] < limit).replace(" ", "")
    m = re.match(r"^(\d{1,3})[-–](\d{1,3})$", text)
    if m:
        return [int(m.group(1)), int(m.group(2))]
    if re.match(r"^\d{1,3}$", text):
        return [int(text), int(text)]
    return None


def span(row, low, high):
    return " ".join(w["text"] for w in row if low <= w["x0"] < high).strip()


def extract_talents(pdf):
    page = pdf.pages[87]
    out = []
    for row in rows_of(page, 240, 560):
        rolls = leading_range(row, 290)
        if not rolls:
            continue
        name = span(row, 290, 440)
        cost_text = span(row, 440, 560)
        if not name:
            continue

        # "(w)" marks an ability only a Well Aspected character may have.
        well = "(w)" in name
        name = re.sub(r"\s*\(w\)", "", name).strip()

        # Most cost PC Points; a few can only be come by on the dice.
        cost = re.match(r"^(\d+)", cost_text)
        out.append({
            "name": name,
            "roll": rolls,
            "pcCost": int(cost.group(1)) if cost else None,
            "randomOnly": cost is None,
            "wellAspectedOnly": well,
            "page": 88,
        })
    return out


def extract_flaws(pdf):
    """Table - Flaws (p95).

    Two columns of the same shape sit side by side, with a third column of
    footnotes further right that must be kept out of both. A name too long for
    its column wraps onto the following line.
    """
    page = pdf.pages[94]
    columns = [(76, 120, 196, 240), (261, 303, 380, 420)]
    out = []

    for roll_x, name_x, cost_x, end_x in columns:
        column = []
        for row in rows_of(page, roll_x - 4, end_x):
            rolls = leading_range(row, name_x - 4)
            name = span(row, name_x - 4, cost_x - 4)
            cost_text = span(row, cost_x - 4, end_x)

            if not rolls:
                # A name that wrapped belongs to the entry above it.
                if name and column and not cost_text:
                    column[-1]["name"] = f'{column[-1]["name"]} {name}'.strip()
                continue
            if not name:
                continue

            # A superscript footnote marks the entries that send the reader to
            # the Phobias or Curses table for the detail.
            footnote = bool(re.search(r"\d$", name))
            name = re.sub(r"\s*\d+$", "", name).strip()

            bonus = re.search(r"\+?(\d+)", cost_text)
            column.append({
                "name": name,
                "roll": rolls,
                "pcBonus": int(bonus.group(1)) if bonus else None,
                "rollsOnAnotherTable": footnote,
                "page": 95,
            })
        out.extend(column)

    return sorted(out, key=lambda f: f["roll"][0])


# The small 1D10 table at the foot of p95, transcribed rather than parsed.
#
# Five rows, and every one of them awkward: the names sit in a column of their
# own to the right of the costs, two wrap onto the line below their roll and two
# onto the line above it, and the page's prose runs alongside close enough to be
# picked up as a continuation. A parser that coped with all that would be longer
# than the table and harder to check.
#
# Note the first two rows: the book prints the same text for both, at different
# costs. That is as printed.
ADDITIONAL_FLAWS = [
    {"name": "Minor Phobia & roll again for another flaw", "roll": [1, 5], "pcBonus": 7,
     "rollsOnAnotherTable": True},
    {"name": "Minor Phobia & roll again for another flaw", "roll": [6, 6], "pcBonus": 13,
     "rollsOnAnotherTable": True},
    {"name": "Cursed", "roll": [7, 8], "pcBonus": 7, "rollsOnAnotherTable": True},
    {"name": "Twice Cursed", "roll": [9, 9], "pcBonus": 13, "rollsOnAnotherTable": True},
    {"name": "Thrice Cursed", "roll": [10, 10], "pcBonus": 21, "rollsOnAnotherTable": True},
]


def extract_additional_flaws(pdf):
    return [{**row, "die": "1d10", "page": 95} for row in ADDITIONAL_FLAWS]


def extract_phobias(pdf):
    """Table - Phobias (pp.96-97).

    A name too long for its column wraps above and below its own roll, as
    Androphobia and Gynophobia do, so name fragments on their own line are
    gathered onto whichever entry they belong to.
    """
    out = []
    for pno in (95, 96):
        page = pdf.pages[pno]
        pending = []
        # An entry whose own name cell was empty is still waiting for the rest
        # of its name, which is printed below its roll rather than above it.
        awaiting = None

        for row in rows_of(page, 60, 580):
            if any(w["text"].startswith("1D100") for w in row):
                continue

            rolls = leading_range(row, 108)
            name = span(row, 108, 210)
            fear = span(row, 210, 580)

            if not rolls:
                if name and not fear:
                    # A long name straddles its own roll — Androphobia above it
                    # and "or Gynophobia" below — so a fragment goes to the
                    # entry still missing a name, or waits for the next one.
                    if awaiting is not None:
                        awaiting["name"] = f'{awaiting["name"]} {name}'.strip()
                        awaiting = None
                    else:
                        pending.append(name)
                # Fear texts all fit one line; anything else on that side of
                # the page is the prose column bleeding in, so it is ignored.
                continue

            full = " ".join([*pending, name]).strip()
            pending = []
            if not full:
                continue

            entry = {"name": full, "roll": rolls, "fear": fear, "page": pno + 1}
            out.append(entry)
            awaiting = entry if not name else None
    return out


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        talents = extract_talents(pdf)
        flaws = extract_flaws(pdf)
        additional = extract_additional_flaws(pdf)
        phobias = extract_phobias(pdf)
    print(f"talents {len(talents)}  flaws {len(flaws)}  "
          f"additional {len(additional)}  phobias {len(phobias)}", file=sys.stderr)
    json.dump({"talents": talents, "flaws": flaws,
               "additionalFlaws": additional, "phobias": phobias},
              sys.stdout, indent=2, ensure_ascii=False)
