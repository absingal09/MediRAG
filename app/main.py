from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from app.db import connect
from app.search import search
from pydantic import BaseModel, Field
from app.ask import ask, ask_stream
from contextlib import closing
import json
import logging

logger = logging.getLogger("uvicorn.error")

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

class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)

@app.post("/ask")
def ask_endpoint(req: AskRequest):
    return ask(req.question)

@app.post("/ask/stream")
def ask_stream_endpoint(req: AskRequest):
    def events():
        try:
            with closing(ask_stream(req.question)) as stream:
                for event in stream:
                    text = json.dumps(event["data"], ensure_ascii=False)
                    yield f"event: {event['event']}\ndata: {text}\n\n"
        except Exception:
            logger.exception("Streaming answer failed")
            error = json.dumps({"message": "Answer generation failed. Discard provisional text."})
            yield f"event: error\ndata: {error}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream"
    )