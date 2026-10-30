def same_box(a, b, max_gap=15):
    overlap = min(a["x1"], b["x1"]) - max(a["x0"], b["x0"])
    narrower = min(a["x1"] - a["x0"], b["x1"] - b["x0"])
    gap = max(b["y0"] - a["y1"], a["y0"] - b["y1"])
    if (
        a["page_no"] == b["page_no"]
        and overlap > 0.8 * narrower
        and gap <= max_gap
    ):
        return True
    return False

def group_blocks(blocks):
    blocks = sorted(blocks, key = lambda b: (b["page_no"], b["y0"], b["x0"]))
    groups = []

    for block in blocks:
        matches = [g for g in groups if any(same_box(m, block) for m in g)]

        if not matches:
            groups.append([block])
        else:
            merged = [block]
            for g in matches:
                merged.extend(g)
                groups.remove(g)
            groups.append(merged)

    for g in groups:
        g.sort(key=lambda b: (b["y0"], b["x0"]))

    return groups

def box(group):
    # The rectangle around a whole group, plus its joined text.
    return {
        "page_no": group[0]["page_no"],
        "x0": min(b["x0"] for b in group),
        "y0": min(b["y0"] for b in group),
        "x1": max(b["x1"] for b in group),
        "y1": max(b["y1"] for b in group),
        "text": " ".join(b["text"] for b in group),
    }

def is_heading(group):
    # Short and ALL CAPS, e.g. 'COMMON ERRORS/PITFALLS IN DKA ...'.
    text = box(group)["text"]
    return len(text) < 60 and text.isupper()

def find_heading(group, groups):
    """Closest heading above this group that overlaps it horizontally."""
    if is_heading(group):
        return ""                      # a heading doesn't need a heading
    g = box(group)
    best = None
    for other in groups:
        if other is group or not is_heading(other):
            continue
        h = box(other)
        same_page = h["page_no"] == g["page_no"]
        above = h["y1"] <= g["y0"] + 2          # +2: headings can touch their content
        overlaps = min(h["x1"], g["x1"]) - max(h["x0"], g["x0"]) > 0
        if same_page and above and overlaps:
            if best is None or h["y1"] > best["y1"]:   # keep the closest one
                best = h
    return best["text"] if best else ""

def make_chunks(blocks):
    groups = group_blocks(blocks)
    chunks = []
    for group in groups:
        if (
            is_heading(group)
            or group[0]["text"].startswith(("ABBREVIATIONS", "REFERENCES"))
        ):
            continue
        heading = find_heading(group, groups)
        for piece in split_text(box(group)["text"]):
            chunks.append({
                "doc_name": group[0]["doc_name"],
                "page_no": group[0]["page_no"],
                "heading": heading,
                "text": piece,
            })
    return chunks

def split_words(text, max_chars):
    # Cut text into pieces of at most max_chars, breaking only between words.
    pieces, current = [], ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if len(candidate) <= max_chars:
            current = candidate             # still fits -> keep adding
        else:
            pieces.append(current)          # full -> save it, start a new piece
            current = word
    if current:
        pieces.append(current)              # appending the last piece
    return pieces

def split_text(text, max_chars=800):
    # Cut a long chunk into pieces, preferring to break between bullets.
    if len(text) <= max_chars:
        return [text]                           # short enough -> leave it alone

    parts = text.split(" • ")
    parts = [parts[0]] + ["• " + p for p in parts[1:]] # put the bullets back

    pieces, current = [], ""
    for part in parts:
        if len(part) > max_chars:               # one bullet alone is too long
            if current:
                pieces.append(current)
                current = ""
            pieces.extend(split_words(part, max_chars))
            continue
        candidate = f"{current} {part}".strip()
        if len(candidate) <= max_chars:
            current = candidate                 # bullet fits -> add it
        else:
            pieces.append(current)              # piece is full -> save, start new one
            current = part
    if current:
        pieces.append(current)
    return pieces