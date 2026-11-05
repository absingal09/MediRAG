# MediRAG

RAG over ICMR Standard Treatment Workflows: answers clinical questions with
document and page citations, refuses when the guidelines don't cover it, and
is measured on a 40-question eval set.

> Work in progress. A guideline lookup tool, not medical advice.

## Setup (Windows, PowerShell)

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env            # fill in POSTGRES_PASSWORD, DATABASE_URL, SARVAM_API_KEY

docker compose up -d              # Postgres + pgvector on port 5433
python -m scripts.ingest          # parse, chunk, embed and store all PDFs
uvicorn app.main:app --reload     # http://127.0.0.1:8000/health
```
## Frontend

Keep FastAPI running on port 8000. In a separate terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. See `frontend/README.md` for details.

## Layout

| Path | What |
|---|---|
| `DESIGN.md` | Design decisions and evaluation plan |
| `docs/BUILD_LOG.md` | What was built, in order, and why |
| `data/pdfs/` | 14 ICMR STW PDFs |
| `data/sources.csv` | Official URL and edition of each PDF |
| `db/schema.sql` | Tables |
| `app/` | API code |
| `scripts/` | Ingestion and inspection scripts |
| `evals/questions.yaml` | 40 eval questions (30 dev, 10 held-out) |

## Status

- [x] Design, data and evaluation set
- [x] Local PostgreSQL + pgvector in Docker
- [x] Extraction, chunking, embedding and storage: 494 chunks
- [x] Search and answers with citations and refusal
- [x] Dev baseline evaluation and manual answer review
- [x] Streaming, caching, usage logging, retries and model fallback
- [x] React frontend, PDF reader and citation highlighting
- [x] Hosted PostgreSQL + pgvector — Supabase setup
- [x] Deployment — [frontend](https://medirag-desk.vercel.app/) on Vercel, [backend](https://medirag-3xvf.onrender.com/) on Render
- [ ] Resolve evaluation-label ambiguities; held-out evaluation after tuning

## Deferred tasks

- [ ] Searchable PDF uploads: backend upload/ingestion endpoint,
  connected frontend control and progress/error feedback.
  Current imports support local preview only.
