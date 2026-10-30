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
uvicorn app.main:app --reload     # http://127.0.0.1:8000/health
```

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

- [x] Design, data, eval set
- [x] Repo setup (Docker, schema, `/health`)
- [ ] Extraction audit
- [ ] Ingestion
- [ ] `/search`, `/ask`
- [ ] Baseline evals