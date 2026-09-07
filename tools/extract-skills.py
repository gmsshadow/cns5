"""Positional parser for the Chivalry & Sorcery 5e skills list (pp.147-148)."""
import collections, json, re, sys

import pdfplumber

PDF = sys.argv[1] if len(sys.argv) > 1 else "CS_5th_Edition_Digital_Colour_2020_HAPPY_PRINTER.pdf"
PAGES = (146, 147)          # zero-based; printed pages 147-148
ROW_TOLERANCE = 3           # points; words within this band are the same row
HEADER_INDENT = 25          # a name-only row indented this far is a category heading


def block_layout(words):
    """Locate the three column blocks from the repeated Page / DF / ATT headers."""
    header = [w for w in words if w["text"] in ("Page", "DF", "ATT") and w["top"] < 35]
    header.sort(key=lambda w: w["x0"])
    cols = collections.defaultdict(list)
    for w in header:
        cols[w["text"]].append(w["x0"])
    return [
        {
            "start": cols["Page"][i] - 100,   # names begin ~100pt left of the Page column
            "page": cols["Page"][i] - 5,
            "df": cols["DF"][i] - 8,
            "att": cols["ATT"][i] - 15,
        }
        for i in range(3)
    ]


def classify(word, block):
    if word["x0"] < block["page"]:
        return "name"
    if word["x0"] < block["df"]:
        return "page"
    if word["x0"] < block["att"]:
        return "df"
    return "att"


# The book prints one category heading as 'Atheletic'.
CATEGORY_FIXES = {"Atheletic": "Athletic"}


def parse_attributes(tokens):
    """Turn 'STR + AGL', 'WIS X 2', 'COMP' or 'N/A' into a list of attribute keys."""
    text = " ".join(tokens).upper().replace("–", "-")
    if "COMP" in text:
        return [], "competency"
    keys = re.findall(r"\b(STR|CON|DEX|AGL|INT|WIS|DIS|FER|APP|BV|SPR|CHA)\b", text)
    if re.search(r"\bX\s*2\b", text) and len(keys) == 1:
        keys = keys * 2                       # 'WIS X 2' is the same attribute twice
    return [k.lower() for k in keys], "skill"


def extract():
    entries = []
    category = None            # carries across column and page breaks
    with pdfplumber.open(PDF) as pdf:
        for pno in PAGES:
            page = pdf.pages[pno]
            words = page.extract_words(extra_attrs=["fontname"])
            blocks = block_layout(words)

            for block in blocks:
                in_block = [w for w in words if block["start"] <= w["x0"] < block["start"] + 179]
                if not in_block:
                    continue
                name_left = min(
                    (w["x0"] for w in in_block if w["x0"] < block["page"]), default=block["start"]
                )

                rows = collections.defaultdict(list)
                for w in in_block:
                    rows[round(w["top"] / ROW_TOLERANCE)].append(w)

                pending_name = []
                awaiting_name = None    # an entry whose name continues on later rows

                for key in sorted(rows):
                    row = sorted(rows[key], key=lambda w: w["x0"])
                    if row[0]["top"] < 35:
                        continue                     # the column header itself

                    parts = collections.defaultdict(list)
                    for w in row:
                        parts[classify(w, block)].append(w["text"])

                    has_data = parts["df"] and parts["att"]
                    name_words = parts["name"]

                    if not has_data:
                        if not name_words:
                            continue
                        indented = row[0]["x0"] > name_left + HEADER_INDENT
                        if indented:
                            heading = " ".join(name_words)
                            category = CATEGORY_FIXES.get(heading, heading)
                            pending_name, awaiting_name = [], None
                        elif awaiting_name is not None:
                            # The tail of a name that wrapped around its own data
                            # row. Exactly one such row belongs to the entry; any
                            # further name-only row starts the next skill.
                            awaiting_name["name"] += " " + " ".join(name_words)
                            awaiting_name = None
                        else:
                            pending_name.extend(name_words)
                        continue

                    name = " ".join(pending_name + name_words).strip()
                    attributes, kind = parse_attributes(parts["att"])
                    raw_att = " ".join(parts["att"])
                    entry = {
                        "name": name,
                        "category": category,
                        "reference": parts["page"][0] if parts["page"] else "",
                        "df": int(parts["df"][0]) if parts["df"][0].isdigit() else None,
                        "attributes": attributes,
                        "kind": kind,
                        "_sort": (pno, block["start"], row[0]["top"]),
                    }
                    # A handful of entries print something other than an
                    # attribute pair — 'N/A' for the Alertness skills, 'Various'
                    # for Druidic Priest Mode. Keep the printed text so the
                    # sheet can show why there is no attribute bonus.
                    if not attributes and kind == "skill":
                        entry["attributeNote"] = raw_att
                    entries.append(entry)
                    pending_name = []
                    awaiting_name = entry if not name_words else None

    entries.sort(key=lambda e: e["_sort"])
    for e in entries:
        e.pop("_sort")
        e["name"] = re.sub(r"\s+", " ", e["name"]).strip()
    return entries


if __name__ == "__main__":
    data = extract()
    print(f"extracted {len(data)} entries", file=sys.stderr)
    json.dump(data, sys.stdout, indent=2, ensure_ascii=False)
