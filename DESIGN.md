# MediRAG – Design

## Goal
Doctors and medical students ask clinical questions and get answers **only from
official ICMR treatment guidelines**, with a citation to the document and page.
If the guidelines don't cover the question, it should say so instead of guessing.

This is a retrieval prototype, not a clinical tool. A "not medical advice" label
does not make it reliable; the evals below are what measure that.

## Data
- 14 ICMR Standard Treatment Workflow (STW) PDFs: STEMI, NSTEMI, atrial
  fibrillation, heart failure, aortic syndrome, stroke, headache, DKA, type 2
  diabetes, asthma, dengue, sepsis in children, appendicitis, GI bleed.
- 13 are one page; aortic syndrome is two.
- **Provenance:** `data/sources.csv` records, for each file, its official ICMR
  URL, the edition date printed on the PDF (e.g. "July/2022") and the download
  date. Answers can then be traced to the guideline edition used.
- **The tricky part: they are flowcharts, not prose.** Boxes, arrows, tables
  and multi-column layouts. Extracted text can mix columns or branches, lose
  which condition an instruction belongs to, and break table rows (e.g. the
  GRACE score). Some text may be inside images.

## Ingestion
1. **Extract:** PyMuPDF `page.get_text("blocks")` (chosen after the audit;
   plain text and pymupdf4llm mixed columns). Every block keeps `doc_name`,
   `page_no` and its position `x0, y0, x1, y1`. Text is cleaned (ligatures
   normalised, whitespace collapsed) and boilerplate blocks are dropped
   (disclaimer, header, edition date, `stw.icmr.org.in` watermark).
2. **Extraction audit (before any tuning):** for each PDF, compare the
   extracted text with the page by eye and record in `docs/extraction_audit.md`:
   - is the reading order correct, or are columns/branches mixed?
   - are conditions still attached to their actions ("if pH < 7.0 → add bicarbonate")?
   - are tables readable row by row?
   - is any text image-only (present on the page, missing from extraction)?

   Material that is lost or garbled is marked **unsupported**. Eval questions
   that depend on it are flagged, not silently counted as retrieval failures.
   This step matters most: if extraction loses a condition or a table
   association, good retrieval and fluent generation can still produce a
   misleading answer.
3. **Chunk by box, not by fixed size:** blocks are grouped into flowchart
   boxes: same page, horizontally aligned (overlap ≥ 80% of the narrower
   block, so headings spanning two columns don't glue them together) and
   vertically close (gap ≤ 15 pt). Each box gets the nearest ALL-CAPS heading
   above it. Boxes over 600 characters are split at bullet boundaries.
   No overlap: each chunk is a whole box or a piece of one.
   - Why not fixed 500-token chunks with overlap? They would mix side-by-side
     columns, which is exactly the failure the audit found.
   - Result: 494 chunks across 14 PDFs, all ≤ 600 characters.
4. **Embed:** `all-MiniLM-L6-v2`: 384-dim vectors, max 256 tokens. The first
   limit (800 characters, estimated ~200 tokens) produced a 265-token chunk:
   doses and units tokenize densely. At 600 characters the largest chunk is
   211 tokens. The ingest script checks every chunk with the model's tokenizer
   and fails if any exceeds the limit.
   The heading is prepended to the text that gets embedded.
5. **Re-ingest command:** one script wipes the tables and re-ingests all PDFs.

## Storage (Postgres + pgvector)
```
documents(id, name, source_url, edition, pages)
chunks(id, document_id → documents.id, page_no, heading, content, embedding vector(384))
```
- **Index:** at ~500 chunks, exact search (no index) is fast enough and has
  less overhead. HNSW is an approximate index for larger collections; add it
  only if the document set grows and latency is measured to need it.

## Retrieval
- Embed the question with the same model, order chunks by cosine distance
  (`<=>`), take the **top 5**.
- **If results are bad**, candidate experiments (one at a time, measured; none
  is assumed to work):
  1. **Hybrid search:** BM25 + vector, merged with Reciprocal Rank Fusion.
     *May* help exact terms such as drug names and doses. Matching a dose
     string does not show it belongs to the right condition or branch, so
     answers still need checking.
  2. **Reranking:** retrieve 20, re-score with a cross-encoder, keep 5.
  3. **Chunk size:** 300 / 600 / 1000 characters.
- First, look at *why* each miss happens before picking a fix.

## Answering
- **Prompt:** system instructions + the 5 chunks numbered `[S1]…[S5]`, each
  labelled with document and page + the question.
- **Citations:** the model writes `[S2]`; code maps `S2 → (doc, page)`. This
  stops the model from inventing page metadata. It does **not** prove the cited
  chunk supports the claim; that is checked in evals.
- **Invalid citations:** a tag that points to no source (e.g. `[S9]`) means
  the answer is unreliable. The answer is retried once; if it fails again it is
  returned as a refusal. Bad tags are never silently deleted, since that would
  leave an unsupported claim with no citation.
- **Refusal:** the model is told to reply exactly `NOT_IN_DOCUMENTS` when the
  sources don't answer. This makes refusals easy to detect, but the prompt
  doesn't guarantee correct refusals or exact formatting, so evals test both
  (refusing when it should, not refusing when it shouldn't).
- **Temperature 0:** reduces variation between runs; it does not guarantee
  identical answers.

## API (FastAPI)
| Method | Path | Input | Output |
|---|---|---|---|
| GET | `/health` | none | `{status}`; checks the DB connection |
| GET | `/documents` | none | documents with edition, URL and chunk counts |
| POST | `/search` | `{query, k}` | top-k chunks with doc, page, score (for debugging) |
| POST | `/ask` | `{question}` | `{answer, refused, citations[{doc, page}], sources[]}` |

## Evaluation (`evals/questions.yaml`, 40 questions)
25 direct, 10 multi-part, 5 unanswerable.

**Split:** 30 *dev* questions for tuning and 10 *held-out* questions (mix of
all three types) that are only run at the end. Tuning repeatedly on the same
questions overfits them; the held-out score is the one that gets reported.

| Metric | What it tells me |
|---|---|
| **hit@5** | Was at least one correct page in the top 5? |
| **Evidence coverage** | For multi-part questions: were *all* required pages/facts retrieved? Finding one is not enough. |
| **MRR** | How high the first correct page ranked |
| **Answer accuracy** | LLM judge vs. reference answer. An *estimate*: every failure, plus a sample of passes, is checked by hand for condition, dose, units and thresholds. |
| **Citation support** | Does each cited chunk actually contain the claim? Checked by hand on a sample. |
| **Refusal** | Refused unanswerable questions, reported as counts (e.g. 4/5), not just percentages |
| **False refusals** | Wrongly refused answerable questions, as counts |

**Caveats**
- Most PDFs are one page, so hit@5 mostly measures "right document" and will
  look high. Answer accuracy and evidence coverage are the real tests.
- 5 unanswerable questions is a smoke test, not proof of refusal reliability.
  Add more before making any claim about it.

**Baseline:** vector-only, 600/100 chunks, top 5, after the extraction audit.
Record every metric before changing anything. Then one change at a time; keep
it only if dev scores improve, and confirm on the held-out set at the end.

## Out of scope (for now)
- OCR for image-only text (it's identified in the audit and marked unsupported)
- More documents (add later, re-run evals)
- User accounts, chat history
- Deployment (after evals work locally)