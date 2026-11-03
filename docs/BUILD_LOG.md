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
(Later lowered to 600 characters → 494 chunks; see Phase 4.)

### Bugs hit and what they taught
- **Ligatures:** `ﬁ` is one character, so "first" didn't match "ﬁrst" → `unicodedata.normalize("NFKC")`
- **`return` inside the loop** → only 1 group came back
- **Headings spanning two columns glued them together** → overlap must cover ≥ 80% of the narrower block
- **Vertical `stw.icmr.org.in` watermark glued whole columns** (Asthma: one 3,836-char chunk) → removed as boilerplate
- **Huge single blocks** (Aortic complications table) over the embedding limit → split at bullets into ≤ 800 chars
- **`startswith("A", "B")`** → second argument is a position; pass a tuple `startswith(("A", "B"))`
- **Running a script inside `scripts/` couldn't import `app`** → run as a module: `python -m scripts.check_parse`

## Phase 4 – Embed and store (Oct 31)

| File | What |
|---|---|
| `db/schema.sql` | Added `heading TEXT NOT NULL DEFAULT ''` to `chunks` (DB reset with `down -v`) |
| `app/embeddings.py` | Loads all-MiniLM-L6-v2 once. `embed()` returns normalized 384-dim vectors; `count_tokens()` uses the model's own tokenizer |
| `scripts/ingest.py` | `load_sources()` reads sources.csv; `insert_document()` (`RETURNING id`); `insert_chunks()` (`executemany`); `main()` wipes and re-ingests everything |

**Run:** `python -m scripts.ingest` → **14 documents, 494 chunks.** Verified per-document counts in Postgres.

How ingest works:
- `TRUNCATE documents RESTART IDENTITY CASCADE` empties both tables, so re-running never duplicates.
- Embedded text = heading + text; stored `content` = text only, heading in its own column.
- Any chunk over 256 tokens **raises an error** instead of being silently truncated.
- Everything runs in one transaction: if anything fails, nothing changes (the wipe is rolled back too).
- Adding a PDF = add it to `data/pdfs/` **and** a row to `data/sources.csv`, then re-run.
- No HNSW index: exact search is enough at ~500 chunks (see DESIGN.md).

### Bugs hit and what they taught
- **Character estimate was wrong:** 800 chars was assumed ≈ 200 tokens, but the real max was 265 (> 256).
  Doses, units and abbreviations tokenize densely (~3 chars/token here) → lowered to 600 chars; max is now 211.
- **`psql` failed right after `docker compose up`** → Postgres needs a few seconds to initialise a fresh volume
- **`NameError: connect`** → a script must import everything it uses
- **SQL placeholders:** values go in as `%s` parameters, never f-strings (SQL injection)

## Phase 5 – /search and /ask (Oct 31)

| File | What |
|---|---|
| `app/search.py` | `search(query, k)`: embed the query, order chunks by cosine distance (`<=>`), score = 1 − distance. Returns doc, page, heading, content, score. |
| `app/prompting.py` | System prompt (answer only from sources, cite `[S1]`, copy doses exactly, refuse with `NOT_IN_DOCUMENTS`). `build_messages()` numbers chunks `[S1] (doc, page) HEADING`. `parse_answer()` detects refusal, finds `[S<n>]` tags, maps each to its chunk's doc + page, collects tags pointing to no source in `invalid`. |
| `app/llm.py` | `complete(messages)`: Sarvam chat API, temperature 0, `reasoning_effort` low, 60 s timeout. Raises with Sarvam's own error text on failure. |
| `app/ask.py` | `ask(question)`: search → prompt → LLM → parse. Invalid citations → retry once; still invalid → refuse. Refusals return "I couldn't find this in the guidelines." Sources attached so answers can be checked. |
| `app/main.py` | `GET /search?q=…&k=…` (`k` limited to 1–20 with `Query`); `POST /ask` with a Pydantic `AskRequest` (question 3–500 characters, otherwise 422). |

### Results
- *"What is the aspirin loading dose?"* → "325 mg [S1][S2]", cited STW_STEMI p.1 and STW_NSTEMI p.1 ✅
- *"Anti-snake venom dose for a krait bite?"* (not in any PDF) → refused ✅
- Same question, two runs, temperature 0: "325 mg [S1][S2]" vs a full sentence.
  Temperature 0 reduces variation but doesn't remove it.

### What `parse_answer` does and doesn't check
- ✅ Every `[S<n>]` points to a real source, then it's converted to doc + page.
  The model never writes page numbers, so it can't invent one.
- ❌ It does **not** check that the cited chunk actually contains the claim
  (a wrong dose with a valid `[S1]` passes). That's measured in evals; a possible
  later check is that every number in the answer appears in the cited chunk.

### Retrieval observations (baseline, vector-only)
- Tenecteplase dose question: right document in the top 5, but the dose chunk isn't in the top 20.
- Query `tenecteplase dose`: top 3 are heart-failure and headache doses.
- An NSTEMI chunk glued the two drug columns ("…90 mg BD Anti thrombotics: 1. Metoprolol…")
  and got the wrong heading ("ANGINA UNLIKELY IF:").
- Causes: small model doesn't understand drug names; mixed-topic chunks; tiny fragments
  ("Yes", "Immediately") rank high. Details in `docs/extraction_audit.md`.
- Not fixed yet: the baseline eval measures it first.

### Bugs hit and what they taught
- **403 with a brand-new key:** an old `SARVAM_API_KEY` in the system environment
  overrode `.env`, because `load_dotenv()` doesn't override by default → `override=True`
- **Sarvam rejects unknown parameters** (`reasoning-effort` vs `reasoning_effort`) → read the error body, not just the status code
- **`json=messages`** sent a bare list → the API body is an object: model, messages, settings
- **Search SQL without parameters** → 3 `%s` placeholders need 3 values `(vec, vec, k)`
- **`(x,)` vs `(x)`:** commas make a tuple, not brackets; only a 1-item tuple needs the trailing comma
- **`{a, b}` without keys is a set, not a dict** → `{"doc_name": a, "page_no": b}`
- **Dicts have no `.append()`** → add a key with `result["sources"] = chunks`
- **`seen[n]` on a set** → sets use `.add(n)` and `in`; `continue` skips to the next iteration
- **Refusal logic inside the retry loop** → it refused after the first failure and never attached
  sources on success; post-processing belongs after the loop

## Phase 6 – Refusal tests and baseline evals (Nov 2)

| File | What |
|---|---|
| `scripts/eval_refusal.py` | Runs only dev questions through `ask()` and counts correct and false refusals. |
| `scripts/eval_retrieval.py` | Measures hit@5, MRR@5, page coverage and all-required-pages@5 by document + page; prints passages for inspection. |
| `scripts/eval_answers.py` | Saves 30 dev answers, citations and sources in formatted JSON; resumes by saved ID. |
| `scripts/eval_judge.py` | Judges 27 answerable responses against references; validates and saves verdicts, skipping completed IDs. |
| `evals/evidence_review.md` | Manual reference-fact coverage review of 8 multi-part dev questions. |
| `evals/answer_review.md` | Manual review of all 27 answerable responses and their cited evidence. |
| `evals/results.md` | Baseline settings, results and limitations. |

### Results
- **Correct refusals: 3/3; false refusals: 7/27.**
- Two refusal runs produced the same counts.
- **Hit@5: 27/27; MRR@5: 0.907.**
- **Mean page coverage@5: 100%; all-required-pages@5: 27/27.**
- Page-level metrics overstate evidence retrieval: q06 passes despite
  missing the answer-bearing chunk.
- Multi-part reference coverage: **full 3/8, partial 4/8, none 1/8**.
- Raw LLM judge: **14 correct, 5 partial, 8 incorrect**.
- All 27 answerable responses manually reviewed; raw verdicts preserved.
- Review found scope penalties (q08, q17), unclear migration detail (q23),
  ambiguous question wording (q34), and unsupported SAH citation linkage (q29).
- q22 substituted special-case targets; q12 required original-PDF checking.
- No adjusted accuracy reported while ambiguities remain.
- Generator and judge: `glm5.3`; no tuning; held-out untouched.

### Bugs hit and what they taught
- **Iterating over `data` yielded keys** → use `data["questions"]`;
  confirmed 30 dev questions before running.
- **Totals updated before metrics; calculations outside the loop**
  → calculate per-question metrics first, then accumulate.
- **Correct page mistaken for complete evidence**
  → inspect required facts, not just document + page.
- **`json.loads(file)`** → use `json.load(file)` for an open file.
- **Appending JSON lists created invalid JSON**
  → save the complete list with `"w"` and `indent=2`.
- **Judge penalized unrequested reference details**
  → manually check question scope and citation support separately.

### Next
- [x] Dev refusal and retrieval baselines.
- [x] Multi-part reference-fact coverage review.
- [x] LLM judging and manual review of all answerable responses.
- [x] Record baseline settings and results in `evals/results.md`.
- [ ] Resolve outstanding label ambiguities before adjusted scoring.
- [ ] Begin measured experiments, one change at a time.

## Phase 7 – Streaming answers (Nov 3)

| File | What |
|---|---|
| `app/llm.py` | Added `stream_complete()`: parses Sarvam SSE events, yields text fragments and closes the response. |
| `app/ask.py` | Added `ask_stream()`: provisional deltas, citation validation, one retry and a final result. Existing `ask()` unchanged. |
| `app/main.py` | Added `POST /ask/stream` with delta, final and error events. |
| `scripts/check_stream.py` | Checks streamed model text. |
| `scripts/check_ask_stream.py` | Checks streamed retrieval and final citations. |
| `scripts/check_stream_retry.py` | Mocks invalid citations to verify retry and final refusal. |

### Results
- Longer answer arrived progressively through curl.
- Answerable question returned mapped citations.
- Unsupported question returned a normalized refusal with no citations.
- Mocked invalid citations triggered one retry, then refusal.
- Deltas are provisional; clients must replace them with the final result
  or discard them on error.
- No retrieval tuning; held-out untouched.

### Bugs hit and what they taught
- **Duplicate pasted functions** → keep one definition of each function.
- **Citation clearing outside the invalid check** → successful retries
  must retain their citations.
- **`return` in a generator** → use `yield` to deliver the final event.
- **Yielding dictionaries to StreamingResponse** → serialize SSE text
  with a blank line between events.
- **DB connection timeout** → start Docker and the Compose database.

## Phase 8 – Caching and usage logging (Nov 3)

| File | What |
|---|---|
| `app/cache.py` | Shared in-memory cache with deep copies; keys include question, k, corpus, models and pipeline version. |
| `app/config.py` | Added `CORPUS_VERSION`; documented in `.env.example`. |
| `app/telemetry.py` | Structured request logs: mode, cache hit, latency, status and error type; separate model-usage logs. |
| `app/ask.py` | Both answer paths reuse finalized cached results; invalid-citation failures aren't cached. Logs success, errors and generator closure. |
| `app/llm.py` | Captures normal/streaming token usage once per attempted call; closes responses in `finally`. |
| `app/main.py` | Logs streaming exceptions and explicitly closes the answer generator. |
| `scripts/check_cache.py`, `scripts/check_ask_cache.py`, `scripts/check_stream_cache.py` | Mock checks for cache isolation and repeated-request reuse. |
| `scripts/check_request_logging.py`, `scripts/check_usage_logging.py` | Mock checks for failures, generator closure, unknown usage and response cleanup. |

### Results
- Repeated requests skip retrieval and generation; cache shared across endpoints.
- Live `/ask`: **4,589 ms uncached, 0.107 ms cached**; 525 tokens on miss.
- Normal and streaming usage logs verified; cache hits make no model call.
- Failure and closure checks passed without database or API calls.
- Unavailable usage is `null`, not zero.
- Cache resets on restart; update corpus/pipeline versions after relevant changes.
- No retrieval tuning; saved baseline unchanged; held-out untouched.

### Bugs hit and what they taught
- **Timer outside function** → measured time since import; start per request.
- **Empty choices skipped streaming usage** → capture usage before that check.
- **Cached questions hid usage logs** → test an uncached request.
- **Sarvam overload/timeouts** → inspect provider errors and server tracebacks;
  increasing the timeout alone did not resolve overload.
- **1,024 output tokens, 1,023 reasoning tokens** → a successful HTTP response
  can still exhaust the generation budget.
- **List-iterator mock lacked `.close()`** → use a generator mock for closure tests.

### Limitations / next
- Cache is process-local and currently unbounded.
- Incomplete-generation validation remains pending.
- Stream closure was mock-tested; HTTP disconnect detection may wait for
  a blocking provider read. Immediate disconnect handling is not verified.
- Next planner task: timeouts, exponential-backoff retries and model fallback.