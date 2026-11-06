from app.reranking import reranked_search

question = "What should be done for a patient with an appendicular mass, and when should conservative treatment be stopped?"

for rank, chunk in enumerate(reranked_search(question, k=5), start=1):
    print(rank, chunk["chunk_id"], chunk["doc_name"], chunk["rerank_score"])
    print(chunk["content"], "\n")