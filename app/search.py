from app.db import connect
from app.embeddings import embed

SEARCH_SQL = """
    SELECT d.name, c.page_no, c.heading, c.content,
           1 - (c.embedding <=> %s) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    ORDER BY c.embedding <=> %s
    LIMIT %s
"""

def search(query, k=5):
    vec = embed([query])[0]                    # 1. embed the query (one vector, not a list)

    with connect() as conn:
        rows = conn.execute(SEARCH_SQL, (vec, vec, k)).fetchall()              # 2. run SEARCH_SQL with (vec, vec, k), fetch all rows

    return [
        {"doc_name" : name, "page_no" : page, "heading" : heading,
         "content" : content, "score" : score}
        for name, page, heading, content, score in rows
    ]                  # 3. one dict per row: doc_name, page_no, heading, content, score