import sys
import pymupdf

path = sys.argv[1]
doc = pymupdf.open(path)

for page in doc:
    blocks = page.get_text("blocks")
    sorted_blocks = sorted(blocks, key=lambda b: (round(b[1]), b[0]))  # Sort by y, then x coordinates
    for block in sorted_blocks:
        (f"--- page {page.number + 1} ---")
        print(f"y={round(block[1])} x={round(block[0])} | {block[4].strip()}")

# import pymupdf4llm
# md = pymupdf4llm.to_markdown(path)
# print(md)