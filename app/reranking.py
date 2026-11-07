from functools import lru_cache
from sentence_transformers import CrossEncoder
from app.search import vector_search

@lru_cache(maxsize=1)
def get_reranker():
    return CrossEncoder(
        "cross-encoder/ms-marco-MiniLM-L6-v2",
        device="cpu",
    )

def reranked_search(query, k=5):
    candidates = vector_search(query, k=20)

    if not candidates:
        return []

    pairs = [
        (query, chunk["content"])
        for chunk in candidates
    ]

    scores = get_reranker().predict(pairs, batch_size=1)

    scored_chunks = [
        {**chunk, "rerank_score": float(score)}
        for chunk, score in zip(candidates, scores)
    ]

    scored_chunks.sort(
        key=lambda chunk: (-chunk["rerank_score"], chunk["chunk_id"])
    )
    
    return scored_chunks[:k]