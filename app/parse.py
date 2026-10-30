import pymupdf
from pathlib import Path
import re
import unicodedata

def clean_text(text):
    text = unicodedata.normalize("NFKC", text) # ﬁ → fi, ﬂ → fl
    text = re.sub(r"\s+", " ", text)           # any run of spaces/newlines/tabs → one space
    return text.strip()                        # remove spaces at start and end

def is_boilerplate(text):
    if (
        text.startswith(("This STW has been prepared", "Department of Health Research"))
        or re.fullmatch(r"\w+/ ?\d{4}", text)
        or text == "Standard Treatment Workflow (STW)"
        or text == "stw.icmr.org.in"
    ):
        return True
    return False

def parse_pdf(path):
    doc = pymupdf.open(path)
    doc_name = Path(path).stem
    blocks = []

    for page in doc:
        for block in page.get_text("blocks"):
            if block[6] != 0:
                continue
            text = clean_text(block[4])
            if not text:
                continue
            if is_boilerplate(text):
                continue
            blocks.append({
                "doc_name" : doc_name,
                "page_no" : page.number + 1,
                "x0" : block[0],
                "y0" : block[1],
                "x1" : block[2],
                "y1" : block[3],
                "text" : text,
                "block_no" : block[5]
            })
    return blocks