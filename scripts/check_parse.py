from pathlib import Path
from app.parse import parse_pdf
from app.chunking import make_chunks

pdfs = sorted(Path("data/pdfs").glob("*.pdf"))

for pdf in pdfs:
    blocks = parse_pdf(pdf)
    pages = max(b["page_no"] for b in blocks)
    chunks = make_chunks(blocks)
    longest = max(len(c["text"]) for c in chunks)
    too_long = sum(1 for c in chunks if len(c["text"]) > 1000)
    print(pdf.stem, pages, len(blocks), len(chunks), longest, too_long)