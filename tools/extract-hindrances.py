"""Spiritual Hindrances (pp.408-411).

Three kinds, each under its own heading:

    Physical and Worldly Hindrances   fixations on possessions, the flesh, skills
    Self-delusional Hindrances        the ideas of self that mankind clings to
    Cosmic Hindrances                 notions of how Creation works

Each hindrance is a name ending in a colon at the start of a line, sometimes
marked "(Dark)" or "(Potentially Dark)" — a Dark hindrance being "more
problematic than others" and worth +5 PC Points (p408). What is kept is the
name, its kind, and that mark. The description is the rulebook's and is not
shipped, as with every other list in this system.
"""

import json
import re
import sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"

KINDS = {
    "Physical and Worldly Hindrances": "physical",
    "Self-delusional Hindrances": "self",
    "Cosmic Hindrances": "cosmic",
}
STOP = "Recognising and Removing Hindrances"

# "Impulsive Action (Potentially Dark):" — a name, an optional mark, a colon,
# and nothing else on the line.
ENTRY = re.compile(r"^([A-Z][A-Za-z’' ,&\-]{2,40}?)\s*(\((?:Potentially )?Dark\))?:\s*$")
FOOTER = re.compile(r"\(Order #\d+\)")

# The book spells one of them "Bacchanalnaiism". A name is read by people rather
# than matched by the system, so the obvious slip is put right.
CORRECTIONS = {"Bacchanalnaiism": "Bacchanalianism"}


def extract(pdf):
    out = []
    kind = None
    for pno in range(408, 412):
        page = pdf.pages[pno - 1]
        w = page.width
        for box in ((0, 0, w / 2, page.height), (w / 2, 0, w, page.height)):
            text = page.within_bbox(box).extract_text() or ""
            for raw in text.split("\n"):
                line = raw.strip()
                if not line or FOOTER.search(line):
                    continue
                if line in KINDS:
                    kind = KINDS[line]
                    continue
                if line == STOP:
                    return out
                if not kind:
                    continue
                m = ENTRY.match(line)
                if m:
                    mark = (m.group(2) or "").strip("()")
                    out.append({
                        "name": CORRECTIONS.get(m.group(1).strip(), m.group(1).strip()),
                        "kind": kind,
                        "dark": "dark" if mark == "Dark" else "potential" if mark else "none",
                        "page": pno,
                    })
    return out


if __name__ == "__main__":
    with pdfplumber.open(PDF) as pdf:
        hindrances = extract(pdf)
    counts = {}
    for h in hindrances:
        counts[h["kind"]] = counts.get(h["kind"], 0) + 1
    print(f"hindrances {len(hindrances)}  {counts}", file=sys.stderr)
    json.dump(
        {
            "source": "Chivalry & Sorcery 5th Edition core rules, Spiritual Hindrances, pp.408-411",
            "note": "Names, kinds and the Dark mark only. No description text is shipped.",
            "hindrances": hindrances,
        },
        sys.stdout,
        indent=2,
        ensure_ascii=False,
    )
