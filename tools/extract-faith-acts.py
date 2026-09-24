"""The descriptions of the Acts of Faith (pp.441-454).

The vocation tables on pp.145-146 say who may perform each Act and at what
Personal Faith Factor; they say nothing of what an Act does, what it costs, or
what chance it has. All of that is here, in the descriptions, set out with
dotted leaders:

    Prayer to Recognise Evil ‡
    PFF: .................................. 30
    SC: ....................... Faith TSC% -30
    Cost: ................. -3 FP from Cleric

A heading is a short line followed by a PFF line. The marks on it matter: a
dagger is an Act "solely within the competence of ordained priests", a double
dagger one open also to monastics and members of Holy Fighting Orders (p404).

A field's value can run onto a second dotted line — "then 1/2 Recipient's Spirit
AR" — so a continuation is kept with the field above it. What is stored is the
figure or the formula, never the prose: that is the rulebook's.
"""

import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
PAGES = range(441, 455)

# A field's sign sometimes sits before the dots rather than after them —
# "Cost: - .....24 FP from Cleric" — so it is caught either side and kept.
FIELD = re.compile(r"^([A-Z][A-Za-z' /&]{1,24}):\s*(-\s*)?\.{3,}\s*(.*)$")
CONTINUED = re.compile(r"^\.{3,}\s*(.+)$")
FOOTER = re.compile(r"^\s*\d{1,3}\s+[A-Z][\w'’-]+.*\(Order #\d+\)\s*$")

ORDAINED = "†"
MONASTIC = "‡"


def columns(page):
    w = page.width
    for box in ((0, 0, w / 2, page.height), (w / 2, 0, w, page.height)):
        yield page.within_bbox(box).extract_text() or ""


def extract(pdf):
    acts = []
    current = None
    last_field = None
    pending_heading = None

    for pno in PAGES:
        for text in columns(pdf.pages[pno - 1]):
            for raw in text.split("\n"):
                line = raw.strip()
                if not line or FOOTER.match(line):
                    continue

                field = FIELD.match(line)
                if field:
                    label = field.group(1)
                    value = ((field.group(2) or "").strip() + field.group(3).strip()).strip()
                    # The first labelled line after a heading opens a new Act.
                    # Not every Act begins with its PFF: the Sacraments open
                    # with "Auto:", having no chance to speak of, and matching
                    # on PFF alone lost four of them.
                    if pending_heading:
                        current = {
                            "name": pending_heading.replace(ORDAINED, "").replace(MONASTIC, "").strip(),
                            "ordainedOnly": ORDAINED in pending_heading,
                            "monasticOnly": MONASTIC in pending_heading,
                            "page": pno,
                            "fields": {},
                        }
                        acts.append(current)
                    pending_heading = None

                    if current is not None:
                        # Several Acts carry more than one Cost line, one per
                        # person it falls upon.
                        if label in current["fields"]:
                            current["fields"][label] += "; " + value
                        else:
                            current["fields"][label] = value
                        last_field = label
                    continue

                carried = CONTINUED.match(line)
                if carried and current and last_field:
                    current["fields"][last_field] += " " + carried.group(1).strip()
                    continue

                # Prose ends a heading's chance of being one; a short line with
                # no full stop may be the next Act's name.
                last_field = None
                pending_heading = line if len(line) < 60 and not line.endswith(".") else None

    return acts


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        acts = extract(pdf)

    labels = {}
    for act in acts:
        for key in act["fields"]:
            labels[key] = labels.get(key, 0) + 1

    print(f"acts {len(acts)}  fields {labels}", file=sys.stderr)
    json.dump(
        {
            "source": "Chivalry & Sorcery 5th Edition core rules, the Acts of Faith "
                      "descriptions, pp.441-454",
            "note": "The figures and formulae each Act is given, and the marks on its "
                    "name. No description text is shipped.",
            "acts": acts,
        },
        sys.stdout,
        indent=2,
        ensure_ascii=False,
    )
