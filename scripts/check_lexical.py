from app.search import hybrid_search

question = "How does insulin dosing in DKA work, from the starting dose to when the infusion can be stopped?"

for rank, chunk in enumerate(hybrid_search(question, k=5), start=1):
    print(rank, chunk["chunk_id"], chunk["doc_name"], chunk["score"])
    print(chunk["content"], "\n")