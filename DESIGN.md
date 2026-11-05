# MediRAG – Design

## Goal

Answer clinical questions using only official ICMR treatment guidelines,
with document and page citations. Refuse when retrieved sources do not
contain enough evidence.

This is a retrieval prototype, not a validated clinical tool. A refusal
can reflect missing retrieval evidence, not necessarily missing guidance.

## Data

- 14 ICMR Standard Treatment Workflow PDFs: STEMI, NSTEMI, atrial
  fibrillation, heart failure, aortic syndrome, stroke, headache, DKA,
  type 2 diabetes, asthma, dengue, paediatric sepsis, appendicitis and GI bleed.
- 13 PDFs have one page; aortic syndrome has two.
- `data/sources.csv` records official URLs and guideline editions.
- Main challenge: flowcharts, multiple columns and tables can lose reading
  order or detach conditions from instructions during extraction.

## Ingestion

1. **Extract:** PyMuPDF `page.get_text("blocks")`. Retain document, page
   and block coordinates; normalise ligatures/whitespace and remove boilerplate.
2. **Audit:** compare extraction against original PDFs. Record mixed
   columns, broken tables and unsupported material in `docs/extraction_audit.md`.
3. **Chunk:** group nearby, horizontally aligned blocks into flowchart
   boxes. Assign nearby headings and split oversized groups at bullets or words.
   Maximum **600 characters**, **no overlap**, never crossing pages.
4. **Embed:** `all-MiniLM-L6-v2`, normalised **384-dimensional vectors**.
   Embed heading + content. Check the model's 256-token limit explicitly;
   current maximum is 211 tokens.
5. **Store:** re-ingestion clears and rebuilds the corpus in one transaction.
   Current corpus: **14 documents, 494 chunks**.

Grouping and heading assignment are heuristics; incorrect associations remain
possible. Extraction quality must be checked before retrieval tuning.

## Storage

PostgreSQL + pgvector:

```text
documents(id, name, source_url, edition, pages)
chunks(id, document_id, page_no, heading, content, embedding vector(384))
```

- Chunks reference documents; document deletion cascades to their chunks.
- Use exact vector search at the current corpus size.
- Consider HNSW only if growth and measured latency justify approximate search.

## Retrieval

- Embed the question with the same model.
- Order chunks by cosine distance (`<=>`) and take the **top 5**.
- Displayed similarity score = `1 − cosine distance`.

Known weaknesses:
- Exact drug names and doses can retrieve unrelated passages.
- Tiny fragments rank highly.
- Correct document/page retrieval does not guarantee complete evidence.

Planned experiments, measured one at a time:
1. Keyword + vector search, merged with Reciprocal Rank Fusion.
2. Dropping or merging very short fragments.
3. Cross-encoder reranking: retrieve 20, keep 5.
4. Alternative chunk sizes within the embedding token limit.

No retrieval tuning has been applied yet.

## Answering

- Send numbered sources `[S1]…[S5]`, document/page metadata and the question
  to the configured Sarvam model.
- Instruct it to answer only from sources, preserve doses/units and cite claims.
- Map source tags to document/page metadata in code.
- Retry invalid citation tags once; refuse if they remain invalid.
- Detect `NOT_IN_DOCUMENTS` and return a consistent refusal message.
- Valid citation tags do not prove that the cited passage supports the claim.
- Temperature 0 reduces variation; it does not guarantee identical answers.

### Streaming, caching and resilience

- SSE delivers provisional text; the validated final result replaces it.
- Errors/cancellation discard provisional text and stale citations.
- Normal and streaming requests share a process-local answer cache.
- Cache keys include question, retrieval settings, corpus and model/pipeline versions.
- Log request outcomes, latency, cache hits and available token usage.
- Retry eligible network/provider failures with bounded exponential backoff,
  then use the configured fallback model.
- Do not retry or switch models after streaming answer text has been emitted.

Limits: cache is currently unbounded; incomplete-generation detection remains pending.

## API

| Method | Path | Input | Output |
|---|---|---|---|
| GET | `/health` | none | Database connectivity status |
| GET | `/search` | Query parameters: `q`, `k` | Ranked chunks and source metadata |
| POST | `/ask` | `{question}` | Answer, refusal flag, citations, invalid tags and sources |
| POST | `/ask/stream` | `{question}` | SSE `delta`, `final` and `error` events |

Citations use `{doc_name, page_no}`. The frontend library uses a local corpus
catalog; `/documents` is not implemented.

## Frontend

- React + TypeScript + Vite; Editorial Brief interface.
- Question form, streamed answers, workflow library and responsive source drawer.
- PDF reader with page navigation, zoom and expanded view.
- Clicking each citation opens its document/page and highlights its passage,
  including different passages on the same page.
- A frontend index maps all 494 chunks to original PyMuPDF character coordinates.
  Lookup uses document, page, heading and content; PDF hashes detect stale indexes.
- Missing locations retain page access without inventing a highlight.
- Highlights locate retrieved text; they do not independently verify claims.
- Saved interface examples are labelled separately from live answers.
- PDF imports currently provide local preview only.

## Evaluation

`evals/questions.yaml`: 40 questions—25 direct, 10 multi-part, 5 unanswerable.

- **30 dev:** development and tuning.
- **10 held-out:** do not inspect or run until tuning is complete.

| Metric | Purpose |
|---|---|
| Hit@5 and MRR@5 | Whether an expected document/page is retrieved and its rank |
| Page coverage and all-required-pages@5 | Whether all required pages are retrieved |
| Fact-level evidence coverage | Whether passages contain the required facts |
| Answer accuracy | LLM judgement against references, checked manually |
| Citation support | Whether cited passages support answer claims |
| Correct and false refusals | Refusal behaviour, reported as counts |

Baseline: **vector-only, box-based chunks ≤600 characters, no overlap, top 5**.
Dev results and manual reviews are recorded in `evals/results.md`.
Raw judge verdicts are preserved; label ambiguities remain before adjusted scoring.

Page-level metrics can overstate performance because most PDFs have one page.
Change one retrieval component at a time and record every result.

## Hosting — in progress

- Supabase selected for hosted PostgreSQL + pgvector.
- FastAPI connects through a server-side database connection string.
- Docker remains available for local development.
- Selected settings: Data API off, automatic table exposure off, automatic RLS on.
- Hosted schema, ingestion and connectivity checks are pending.
- Frontend/API deployment follows database verification.

## Deferred / out of scope

- Searchable PDF uploads: backend ingestion endpoint and connected frontend
  progress/error handling. Current imports provide preview only.
- OCR for image-only text.
- Additional documents, user accounts and chat history.
- Clinical use without further validation.

Implementation history and verification results: `docs/BUILD_LOG.md`.
Frontend setup: `frontend/README.md`.