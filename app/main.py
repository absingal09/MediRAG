from fastapi import FastAPI, HTTPException
from app.db import connect
from app.search import search

app = FastAPI(title="MediRAG")

@app.get("/health")
def health():
    """Health check endpoint to verify database connectivity."""
    try:
        with connect() as conn:
            conn.execute("SELECT 1")  # Simple query to check if the database is reachable
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

@app.get("/search")
def search_endpoint(q: str, k: int = 5):
    return search(q, k)