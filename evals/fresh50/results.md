# Fresh 50-question supplementary test — results

Completed 7 November 2026 on the unchanged current local pipeline, with answer
caching bypassed. Questions, required facts, evidence quotes, scoring rules,
application/corpus hashes, package versions and database contents were frozen in
`freeze.json` before the first answer was generated.

## Main results

| Metric | Result |
|---|---|
| New questions | 50: 30 direct, 10 multi-part, 10 unanswerable |
| Correct answers, all answerable questions | **33/40 (82.5%)** |
| Partial answers | 0/40 |
| Incorrect answers | 7/40, all false refusals |
| Direct questions correct | 25/30 (83.3%) |
| Multi-part questions correct | 8/10 (80.0%) |
| Correct refusals, unsupported questions | **10/10 (100%)** |
| False refusals, answerable questions | 7/40 (17.5%) |
| Document/page hit@5 | 40/40 (100%) |
| MRR@5 | 0.951 |
| Mean source-page coverage@5 | 100% |
| All required source pages@5 | 40/40 (100%) |

Raw fact-level judge results and assistant adjudication agree: **33 correct,
0 partial, 7 incorrect**. All 50 responses and all cited passages in the 33
substantive answers were reviewed by the assistant against the required facts
and relevant original PDFs. This is not human or independent clinical review.

## Configuration and execution

- Git base: `15a4b2e69912e29e9abcaa6c36562d3ea49d3595`.
- Corpus: the existing 14 documents / 494 chunks; no ingestion or edits.
- Embeddings: `all-MiniLM-L6-v2`, normalized 384-dimensional vectors.
- Retrieval: vector top 20 -> `cross-encoder/ms-marco-MiniLM-L6-v2` -> top 5,
  CPU, batch size 1, no BM25 or short-chunk filter.
- Generator and judge: configured and observed `glm5.3`, temperature 0,
  reasoning effort low, maximum 1,024 completion tokens.
- Existing citation validation, retry and configured fallback behavior retained.
- Exactly 50 generation requests, 50 successful saved responses and 50 unique
  IDs. All generation calls ended with `finish_reason=stop`.
- 33 fact-level LLM judging requests; seven answerable refusals scored directly.
- All 83 recorded model calls returned HTTP 200; no transport failures, fallback
  calls or completed-answer reruns. Total reported model usage: 74,442 tokens
  (69,322 prompt, 5,120 completion).
- Questions/references were not sent to the answer generator as evaluation data;
  it received only each question and the normal retrieved passages.
- No production setting or code, original question, original answer, or old
  evaluation result changed during this run.

## What failed

All seven failures were refusals of questions answerable somewhere in the full
corpus. Their top-five contexts lacked some or all required answer facts:

| ID | Requested information | Evidence available in the top five |
|---|---|---|
| f06 | VKA-specific AF conditions | Required exception passage absent |
| f12 | Acute/subacute/chronic dissection time cut-offs | Chronic cut-off only |
| f19 | FFP/cryoprecipitate indication in dengue | Required passage absent |
| f27 | Octreotide regimen for variceal bleeding | Regimen absent despite correct document |
| f28 | STEMI oxygen threshold | STEMI title plus thresholds from other conditions |
| f34 | HF beta-blocker initiation, titration and monitoring | After-decongestion advice only |
| f40 | Paediatric-sepsis versus GI-bleed oxygen delivery | Adult GI-bleed flow only |

Assistant review of required-fact evidence coverage: **33 full, 3 partial,
4 none**. Perfect page-level retrieval therefore did not mean complete evidence.
The refusals were conservative given incomplete contexts, but remain failures
for end-to-end answering from the complete corpus.

Extra-claim flags on f07, f15, f35 and f39 were checked and supported by the cited
passages and original PDFs; no adjudication changes were made. The extra
potassium advice in f01 was checked too. See `review.md` and `review.json` for
per-question findings and citation mappings.

## Interpretation and limits

- **82.5% is answer correctness on 40 answerable questions**, not 50. Refusal
  correctness has its own 10-question denominator. Do not call this 100% accuracy.
- This is a fresh supplementary sample on the same previously seen corpus,
  authored and reviewed by the assistant. It was not independently authored,
  clinician validated or blinded to the project's prior findings. Multiple
  questions share documents, topics and passages, so observations are correlated.
- References deliberately match the question scope. This sample is not guaranteed
  to have the same difficulty or case mix as the old dev/held-out sets.
- No matched vector-only baseline was generated for these questions. The score
  **does not establish an improvement from 77.8% or from the old 62.5% held-out
  result**. Those earlier results remain unchanged and separate.
- One generation per question, one model family for generation and judging, and
  assistant adjudication do not establish repeatability or independent accuracy.
- For scale only, a binomial Wilson 95% interval for 33/40 is approximately
  68.1%-91.3%; for 10/10 refusals it is 72.2%-100%. These intervals do not correct
  for correlated, non-random, assistant-authored question selection.

## Saved artifacts

- `questions.yaml`: all 50 questions, required facts and original-PDF quotes.
- `protocol.md`, `judge_prompt.txt`, `freeze.json`: pre-generation scoring and
  configuration freeze; `runtime.json`: offline model revisions/execution details.
- `answers.json`: one saved answer, retrieved passages and call metadata per ID.
- `judgements.json`: unmodified raw judge text, per-fact findings and verdicts.
- `review.md`, `review.json`: assistant adjudication of all 50 outputs.
- `retrieval.json`, `summary.json`, `results.json`: per-question retrieval,
  raw-score snapshot and final reviewed results, respectively.

Reproduce or resume using `scripts/eval_fresh50.py`; a changed frozen input aborts
the run. Do not replace completed outputs with a better reroll.
