import re
from app.db import connect
from rank_bm25 import BM25Okapi
from functools import lru_cache

def tokenize(text):
    return re.findall(r"\w+", text.lower())

def load_chunks():
    with connect() as conn:
        rows = conn.execute("""
            SELECT c.id, d.name, c.page_no, c.heading, c.content
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            ORDER BY c.id
        """).fetchall()

    return [
        {"chunk_id": chunk_id, "doc_name": name, "page_no": page, "heading": heading, "content": content}
        for chunk_id, name, page, heading, content in rows
    ]

@lru_cache(maxsize=1)
def build_index():
    chunks = load_chunks()

    # Tokenize heading + content for every chunk.
    tokenized_chunks = [
        tokenize(chunk["heading"] + " " + chunk["content"]) for chunk in chunks
    ]

    index = BM25Okapi(tokenized_chunks)
    return chunks, index

def lexical_search(query, k=5):
    chunks, index = build_index()
    scores = index.get_scores(tokenize(query))

    sorted_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    positive_indices = [i for i in sorted_indices if scores[i] > 0][:k]
    return [ {**chunks[i], "score": float(scores[i])} for i in positive_indices ]