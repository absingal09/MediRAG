from pathlib import Path
from app.parse import parse_pdf

pdfs = Path("data/pdfs").glob("*.pdf")

for pdf in pdfs:
    blocks = parse_pdf(pdf)
    pages = max(b["page_no"] for b in blocks)
    print(pdf.stem, pages, len(blocks))
