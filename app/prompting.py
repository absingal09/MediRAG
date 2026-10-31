import re

REFUSAL = "NOT_IN_DOCUMENTS"

SYSTEM_PROMPT = f"""You answer questions using ONLY the numbered sources provided.
- After every fact, cite its source like [S1] or [S2][S3].
- Use only facts written in the sources. Do not add medical knowledge of your own.
- Copy doses, units and numbers exactly as written.
- If the sources do not contain the answer, reply with exactly: {REFUSAL}
- Be concise."""

def build_messages(question, chunks):
    blocks = []
    for i, c in enumerate(chunks, start=1):
        label = f"[S{i}] ({c['doc_name']}, page {c['page_no']})"
        if c['heading']:
            label += f" {c['heading']}"
        blocks.append(f"{label}\n{c['content']}")

    sources = "\n\n".join(blocks) if blocks else "(no sources found)"

    return [
        {"role" : "system", "content" : SYSTEM_PROMPT},
        {"role" : "user", "content" : f"Sources:\n\n{sources}\n\nQuestion: {question}"},
    ]

def parse_answer(raw, chunks):
    if REFUSAL in raw:
        return {"answer": raw, "refused": True, "citations": [], "invalid": []}

    citations, invalid, seen = [], [], set()
    for tag in re.findall(r"\[S(\d+)\]", raw):
        n = int(tag)
        if n in seen:
            continue
        seen.add(n)
        if 1 <= n <= len(chunks):
            citations.append({
                "doc_name": chunks[n-1]["doc_name"],
                "page_no": chunks[n-1]["page_no"],
            })
        else:
            invalid.append(n)

    return {"answer": raw, "refused": False, "citations": citations, "invalid": invalid}