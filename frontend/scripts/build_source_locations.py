"""Build frontend PDF text locations from the same read-only parsing/chunking code.

Run from the repository root with .venv/Scripts/python frontend/scripts/build_source_locations.py.
No database, embeddings, LLM requests or evaluation questions are accessed.
"""
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path
import sys
import unicodedata

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from app.parse import parse_pdf
from app.chunking import box, find_heading, group_blocks, is_heading, make_chunks, split_text


def compact(text):
    return "".join(c for c in unicodedata.normalize("NFKC", text) if not c.isspace())


def main():
    result = {"version": 1, "files": {}, "locations": []}
    for path in sorted((ROOT / "data" / "pdfs").glob("*.pdf")):
        result["files"][path.stem] = hashlib.sha256(path.read_bytes()).hexdigest()
        parsed = parse_pdf(path)
        groups = group_blocks(parsed)
        expected = Counter((c["page_no"], c["heading"], c["text"]) for c in make_chunks(parsed))
        produced = Counter()
        with pymupdf.open(path) as pdf:
            # Match parse_pdf's BLOCKS flags; RAWDICT defaults include images and
            # can therefore change block numbering and grouping.
            raw = {p.number + 1: {b["number"]: b for b in p.get_text("rawdict", flags=pymupdf.TEXTFLAGS_BLOCKS)["blocks"] if b["type"] == 0} for p in pdf}
            for group in groups:
                if is_heading(group) or group[0]["text"].startswith(("ABBREVIATIONS", "REFERENCES")):
                    continue
                page = group[0]["page_no"]
                chars = []
                for block in group:
                    for line_no, line in enumerate(raw[page][block["block_no"]]["lines"]):
                        for span in line["spans"]:
                            for char in span["chars"]:
                                for letter in compact(char["c"]):
                                    chars.append((letter, char["bbox"], (block["block_no"], line_no)))
                haystack = "".join(char[0] for char in chars)
                heading = find_heading(group, groups)
                for piece in split_text(box(group)["text"]):
                    needle = compact(piece)
                    offsets, start = [], 0
                    while (start := haystack.find(needle, start)) != -1:
                        offsets.append(start)
                        start += 1
                    if not needle or not offsets:
                        raise ValueError(f"Could not locate original text: {path.name} page {page}: {piece[:70]}")
                    lines = defaultdict(list)
                    for offset in offsets:
                        for _, rect, line_id in chars[offset:offset + len(needle)]:
                            lines[(offset, line_id)].append(rect)
                    dimensions = pdf[page - 1].rect
                    if pdf[page - 1].rotation:
                        raise ValueError(f"Rotated corpus page requires explicit coordinate mapping: {path.name}")
                    rects = [[min(r[0] for r in rs) / dimensions.width, min(r[1] for r in rs) / dimensions.height, max(r[2] for r in rs) / dimensions.width, max(r[3] for r in rs) / dimensions.height] for rs in lines.values()]
                    result["locations"].append({"doc": path.stem, "page": page, "heading": heading, "content": piece, "rects": rects})
                    produced[(page, heading, piece)] += 1
        if produced != expected:
            raise ValueError(f"Frontend locations differ from ingestion chunks: {path.name}")
    target = ROOT / "frontend" / "src" / "generated" / "sourceLocations.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Located {len(result['locations'])} chunks across {len(result['files'])} PDFs.")


if __name__ == "__main__":
    main()
