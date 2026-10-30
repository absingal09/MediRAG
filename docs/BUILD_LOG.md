# MediRAG – Build Log

What was done, in order, and why. Add to it as you go.

---

## Phase 0 – Planning and data (Oct 29–30)

### 1. Picked the data
- 14 ICMR Standard Treatment Workflows (STWs): official Indian treatment
  guidelines, one condition per PDF.
- Chosen to overlap with AnviksaAI's conditions (MI, stroke, DKA, dengue, sepsis…).
- Most are 1-page **flowcharts**, which makes text extraction the main challenge.
- `data/sources.csv`: official URL and edition date of every PDF, so answers can
  be traced to the guideline version used.

### 2. Wrote the eval set before writing code
- `evals/questions.yaml`: 40 questions, each with its source document, page and
  a reference answer.
  - 25 direct, 10 multi-part, 5 unanswerable (tests refusal)
  - **30 dev** (used while tuning) / **10 held-out** (run once at the end, the
    score that gets reported). Prevents overfitting to the questions.
- Written *before* the system so the questions aren't biased toward whatever
  the system already handles.

### 3. Design doc
- `DESIGN.md`: data, ingestion, storage, retrieval, answering, API, evals.
- Reviewed by ChatGPT; fixed overclaims (temperature 0 isn't deterministic,
  HNSW not needed at ~100 chunks, invalid citations must not be silently
  dropped) and added the **extraction audit** step.

---

## Phase 1 – Repo setup (Oct 30)

| Step | File | What / why |
|---|---|---|
| 1 | folders | `app/ db/ scripts/ evals/ docs/ data/pdfs/` |
| 2 | `.gitignore` | Keeps `.env` (secrets), `.venv/`, `__pycache__/`, `.vscode/` out of git |
| 3 | `docker-compose.yml` | Postgres 16 + pgvector in Docker. Host port **5433** (5432 is used by genai-basics). Password comes from `.env` via `${POSTGRES_PASSWORD}`. Mounts `db/` so `schema.sql` runs on first start. |
| 4 | `db/schema.sql` | `documents` (name, source_url, edition, pages) and `chunks` (document_id → documents, page_no, content, embedding `vector(384)`). `ON DELETE CASCADE` so deleting a document deletes its chunks. No vector index yet. |
| 5 | `requirements.txt` + `.venv` | Isolated environment so packages don't clash with other projects |
| 6 | `.env` / `.env.example` | `.env` = real secrets (never committed). `.env.example` = same names, no values (committed) |
| 7 | `app/config.py` | Loads `.env` once; every other file imports settings from here. `DATABASE_URL` is required (crash if missing); others have defaults. |
| 8 | `app/db.py` | `connect()` with `register_vector` and `connect_timeout=5` |
| 9 | `app/main.py` | FastAPI app with `GET /health`: `SELECT 1` → 200, DB down → 503 |

### Verified
- `docker exec … psql -c "\dt"` → both tables exist
- `python -c "...connect()...SELECT 1"` → `(1,)`
- `/health` → 200 with DB up, 503 within ~5 s with DB down

### Bugs hit and what they taught
- **Files not saved** (`Ctrl+K` alone doesn't save; it's half a shortcut) → turned on Auto Save
- **`@` in the DB password broke `DATABASE_URL`** (`@` separates password from host) → no special characters, or URL-encode them
- **Mixed-case DB names** → Postgres lowercases unquoted names; use lowercase
- **`/health` hung forever when the DB was down** → no connect timeout; added `connect_timeout=5`
- **`from pgvector.psycopg import psycopg`** worked by accident → import packages directly

### Commands to remember
```powershell
docker compose up -d          # start DB
docker compose stop / start   # pause / resume
docker compose down -v        # delete DB + data (schema re-runs next start)
docker ps                     # what's running
.venv\Scripts\Activate.ps1    # activate venv
uvicorn app.main:app --reload # run API → http://127.0.0.1:8000/docs
```

---

## Phase 2 – Extraction audit (Oct 30)

- `scripts/inspect_pdf.py`: printed DKA, NSTEMI and Aortic Syndrome three ways.
- **Plain text:** headings land after their content; DKA pitfalls run into
  treatment steps (an error to avoid reads like an instruction).
- **Blocks sorted by y:** full-width sections fixed, side-by-side columns interleaved.
- **pymupdf4llm:** best on DKA, but on NSTEMI it merged columns and attached
  doses to the wrong drug (clopidogrel line ended with metoprolol's dose).
- **Decision: `get_text("blocks")`.** Each block's own text is clean; the job
  is grouping blocks correctly, never merging across columns.
- Tables (DKA severity, NSTEMI GRACE, Aortic drug doses) marked unsupported;
  no eval question depends on them.
- Details: `docs/extraction_audit.md`.

## Phase 3 – Parsing and chunking (Oct 30)

| File | What |
|---|---|
| `app/parse.py` | `parse_pdf()`: text blocks with doc, page, x0/y0/x1/y1. `clean_text()`: NFKC (ﬁ→fi) + collapse whitespace. `is_boilerplate()`: drops disclaimer, header, edition date, watermark. |
| `app/chunking.py` | `same_box()` → `group_blocks()` → `find_heading()` → `split_text()` → `make_chunks()` |
| `scripts/check_parse.py` | Per PDF: pages, blocks, chunks, longest chunk, chunks over 1,000 chars |

Result: **470 chunks**, all ≤ 800 characters, every one with doc, page and heading.

### Bugs hit and what they taught
- **Ligatures:** `ﬁ` is one character, so "first" didn't match "ﬁrst" → `unicodedata.normalize("NFKC")`
- **`return` inside the loop** → only 1 group came back
- **Headings spanning two columns glued them together** → overlap must cover ≥ 80% of the narrower block
- **Vertical `stw.icmr.org.in` watermark glued whole columns** (Asthma: one 3,836-char chunk) → removed as boilerplate
- **Huge single blocks** (Aortic complications table) over the embedding limit → split at bullets into ≤ 800 chars
- **`startswith("A", "B")`** → second argument is a position; pass a tuple `startswith(("A", "B"))`
- **Running a script inside `scripts/` couldn't import `app`** → run as a module: `python -m scripts.check_parse`

## Phase 4 – Embed and store (next)
- [ ] Add `heading` column to `chunks`
- [ ] Embed heading + text with all-MiniLM-L6-v2; check real token counts
- [ ] Store documents (with sources.csv URL/edition) and chunks
- [ ] One command to wipe and re-ingest

## Phase 5 – /search and /ask
## Phase 6 – Baseline evals