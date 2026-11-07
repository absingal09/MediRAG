from app.db import connect
from app.embeddings import embed
from app.lexical import lexical_search

SEARCH_SQL = """
    SELECT c.id, d.name, c.page_no, c.heading, c.content,
           1 - (c.embedding <=> %s) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    ORDER BY c.embedding <=> %s
    LIMIT %s
"""

FILTERED_SEARCH_SQL = """
    SELECT c.id, d.name, c.page_no, c.heading, c.content,
           1 - (c.embedding <=> %s) AS score
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE char_length(trim(c.content)) >= 30
    ORDER BY c.embedding <=> %s
    LIMIT %s
"""

def vector_search(query, k=5):
    vec = embed([query])[0]                    # 1. embed the query (one vector, not a list)

    with connect() as conn:
        rows = conn.execute(SEARCH_SQL, (vec, vec, k)).fetchall()              # 2. run SEARCH_SQL with (vec, vec, k), fetch all rows

    return [
        {"chunk_id": chunk_id, "doc_name" : name, "page_no" : page, "heading" : heading,
         "content" : content, "score" : score}
        for chunk_id, name, page, heading, content, score in rows
    ]                  # 3. one dict per row: doc_name, page_no, heading, content, score

def filtered_vector_search(query, k=5):
    vec = embed([query])[0]                    # 1. embed the query (one vector, not a list)

    with connect() as conn:
        rows = conn.execute(FILTERED_SEARCH_SQL, (vec, vec, k)).fetchall()              # 2. run FILTERED_SEARCH_SQL with (vec, vec, k), fetch all rows

    return [
        {"chunk_id": chunk_id, "doc_name" : name, "page_no" : page, "heading" : heading,
         "content" : content, "score" : score}
        for chunk_id, name, page, heading, content, score in rows
    ]                  # 3. one dict per row: doc_name, page_no, heading, content, score


def search(query, k=5):
    from app.reranking import reranked_search

    return reranked_search(query, k)

def reciprocal_rank_fusion(vector_results, lexical_results, k=5):
    scores = {}
    chunks_by_id = {}

    for results in (vector_results, lexical_results):
        for rank, chunk in enumerate(results, start=1):
            chunk_id = chunk["chunk_id"]
            chunks_by_id[chunk_id] = chunk
            scores[chunk_id] = scores.get(chunk_id, 0) + 1 / (60 + rank)

    ranked_ids = sorted(
        scores,
        key=lambda chunk_id: (-scores[chunk_id], chunk_id),
    )[:k]

    return [
        {**chunks_by_id[chunk_id], "score": scores[chunk_id]}
        for chunk_id in ranked_ids
    ]

def hybrid_search(query, k=5):
    vector_results = vector_search(query, k=20)
    lexical_results = lexical_search(query, k=20)
    return reciprocal_rank_fusion(vector_results, lexical_results, k=k)