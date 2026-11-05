# MediRAG – Design

## Goal

Answer clinical questions using only official ICMR treatment guidelines,
with document/page citations. Refuse when retrieved evidence is insufficient.

This is a retrieval prototype, not a validated clinical tool. A refusal may
reflect missing retrieval evidence rather than missing guidance.

## Data

- 14 ICMR Standard Treatment Workflow PDFs; 15 pages in total.
- `data/sources.csv` records official URLs and guideline editions.
- Main extraction challenge: flowcharts, columns and tables can separate
  conditions from their instructions.

## Ingestion

1. **Extract:** PyMuPDF text blocks with document, page and coordinates.
   Normalise ligatures/whitespace and remove boilerplate.
2. **Audit:** compare extraction against original PDFs; record unsupported
   material in `docs/extraction_audit.md`.
3. **Chunk:** group aligned blocks into flowchart boxes, attach nearby headings
   and split oversized groups. Maximum **600 characters**, **no overlap**,
   never crossing pages.
4. **Embed:** heading + content using `all-MiniLM-L6-v2`:
   **384 dimensions**, 256-token limit, current maximum 211 tokens.
5. **Store:** rebuild the corpus in one transaction. Current result:
   **14 documents, 494 chunks**.

Grouping and heading assignment are heuristics and can produce incorrect
associations. Token limits are checked explicitly during ingestion.

## Storage

PostgreSQL + pgvector:

```text
documents(id, name, source_url, edition, pages)
chunks(id, document_id, page_no, heading, content, embedding vector(384))
```

Chunks reference documents with cascading deletion. Exact vector search is
used at the current corpus size; HNSW is deferred until measured need.

## Retrieval

- Embed the question with the same model.
- Retrieve the **top 5** chunks ordered by cosine distance (`<=>`).
- Displayed similarity = `1 − cosine distance`.

Known weaknesses: exact drug names/doses can be missed, tiny fragments rank
highly, and correct page retrieval does not guarantee complete evidence.

Planned experiments, measured one at a time:
1. Keyword + vector search merged with Reciprocal Rank Fusion.
2. Dropping or merging short fragments.
3. Cross-encoder reranking: retrieve 20, keep 5.
4. Alternative chunk sizes within the token limit.

No retrieval tuning has been applied yet.

## Answering

- Send numbered sources `[S1]…[S5]` and the question to the configured Sarvam model.
- Require source-only answers, accurate doses/units and citation tags.
- Map tags to document/page metadata in code.
- Retry invalid tags once; refuse if they remain invalid.
- Convert `NOT_IN_DOCUMENTS` into a consistent refusal message.
- Temperature 0 reduces variation; it does not guarantee identical output.

Valid tags locate sources but do not prove that those sources support the claims.

### Streaming and resilience

- SSE text is provisional; the final result replaces it.
- Errors/cancellation discard provisional text and stale citations.
- Normal and streaming requests share a process-local answer cache.
- Cache keys include question, retrieval settings, corpus and model/pipeline versions.
- Log request outcomes, latency, cache hits and available token usage.
- Retry eligible failures with bounded exponential backoff, then model fallback.
- No retry or model switch after streaming answer text has been emitted.

Limits: cache is unbounded; incomplete-generation detection remains pending.

## API

| Method | Path | Input | Output |
|---|---|---|---|
| GET | `/health` | none | Database connectivity status |
| GET | `/search` | Query parameters: `q`, `k` | Ranked chunks and metadata |
| POST | `/ask` | `{question}` | Answer, refusal, citations, invalid tags and sources |
| POST | `/ask/stream` | `{question}` | SSE `delta`, `final` and `error` events |

Citations use `{doc_name, page_no}`. The frontend uses a local document catalog;
`/documents` is not implemented.

## Frontend

- React + TypeScript + Vite; Editorial Brief interface.
- Streamed answers, workflow library and responsive source drawer.
- PDF reader with page navigation, zoom and expanded view.
- Each citation opens its document/page and highlights its retrieved passage.
- A frontend index maps all 494 chunks to original PyMuPDF character coordinates.
  Lookup uses document, page, heading and content; PDF hashes detect stale indexes.
- Regenerate the index after corpus or chunking changes.
- Unlocatable text retains page access without an invented highlight.
- Highlights locate retrieved text; they do not independently verify claims.
- Saved examples are labelled separately from live answers.
- PDF imports provide local preview only.

## Evaluation

40 questions: 25 direct, 10 multi-part, 5 unanswerable.

- **30 dev:** development and tuning.
- **10 held-out:** do not inspect or run until tuning is complete.

Measure:
- Hit@5, MRR@5, page coverage and all-required-pages@5.
- Fact-level evidence coverage, answer accuracy and citation support.
- Correct and false refusals, reported as counts.

Baseline: **vector-only, chunks ≤600 characters, no overlap, top 5**.
Dev results and manual reviews are in `evals/results.md`. Raw judge verdicts
are preserved; label ambiguities remain before adjusted scoring.

Page-level scores can overstate performance because most PDFs have one page.
Change one retrieval component at a time and record every result.

## Hosting

- **Database hosted on Supabase in Singapore.**
- pgvector enabled in the `extensions` schema.
- FastAPI uses the session pooler over SSL with server-side credentials.
- Hosted counts verified: **14 documents, 494 chunks**.
- Python connection, pgvector registration, health and retrieval checks passed.
- Data API and automatic table exposure off; automatic RLS selected.
- Docker remains available for local development.
- FastAPI deployed on Render Free: https://medirag-3xvf.onrender.com/.
- Frontend deployed on Vercel: https://medirag-desk.vercel.app/.
- Vercel proxies `/api` to Render; deployed health, answer, refusal and citation highlighting checks passed.

## Deferred

- Searchable PDF uploads: backend ingestion endpoint and frontend integration.
- OCR, additional documents, user accounts and chat history.
- Clinical use without further validation.

History and verification: `docs/BUILD_LOG.md`.
Setup: `README.md` and `frontend/README.md`.
