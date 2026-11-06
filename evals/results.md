# MediRAG — Dev Baseline Results

## Scope and settings

- 30 dev questions: 27 answerable, 3 unanswerable.
- Held-out questions untouched.
- 14 documents, 494 chunks.
- Box-based chunking: ≤600 characters, no overlap.
- Embedding: all-MiniLM-L6-v2, normalized 384-dimensional vectors.
- Largest measured embedding input: 211 tokens.
- Retrieval: exact cosine-distance search, top 5.
- Generator and judge: Sarvam-hosted `glm5.3`.
- Temperature 0, reasoning effort low, max_tokens 1024.
- Invalid citations: retry once, then refuse.
- No tuning applied.

## Refusal

| Metric | Result |
|---|---|
| Correct refusals | 3/3 unanswerable questions |
| False refusals | 7/27 answerable questions |

Two refusal runs produced the same counts.

## Retrieval — document + page

| Metric | Result |
|---|---|
| Hit@5 | 27/27 (100%) |
| MRR@5 | 0.907 |
| Mean page coverage@5 | 100% |
| All-required-pages@5 | 27/27 (100%) |

These metrics do not establish that answer-bearing passages were retrieved.
Most documents are one page; q06 passes despite missing the required evidence.

## Multi-part reference-evidence coverage

Manual review of the top-five passages for 8 multi-part dev questions:

| Coverage | Count | IDs |
|---|---|---|
| Full | 3/8 | q27, q28, q34 |
| Partial | 4/8 | q26, q29, q30, q35 |
| None | 1/8 | q32 |

These are reference-coverage categories, not answer-accuracy scores.
See `evidence_review.md`.

## Answer evaluation — raw LLM judge

| Verdict | Count |
|---|---|
| Correct | 14/27 (51.9%) |
| Partial | 5/27 |
| Incorrect | 8/27 |

The eight incorrect answers comprise seven refusals and q22's answer mismatch.
Raw verdicts are preserved in `baseline_judgements.json`.

## Manual review

All 27 answerable responses were reviewed against their references.
Cited passages were inspected for non-refused answers.

- q08 and q17: judge penalized details beyond the question's scope.
  Accepted for the asked scope; q08 leaves the symptom-onset anchor implicit.
- q23: judge marked correct; manual review found unclear pain-migration
  detail in both candidate and extracted source.
- q34: partial; both alternatives were intended. Retrieved evidence contains both, but generation omitted enoxaparin.
- q22: wrong answer for the requested general targets; retrieved sources
  lacked those targets, and the candidate substituted a special case.
- q29: partial answer; cited passages do not establish the claimed SAH link.
- q12: original PDF confirms the answer, but extracted diagnostic text
  interleaves criteria and weakens citation clarity.

Detailed findings are in `answer_review.md`.

## Manually reviewed answer results

| Verdict | Count |
|---|---|
| Correct | 15/27 (55.6%) |
| Partial | 4/27 |
| Incorrect | 8/27 |

Based on the recorded manual decisions: q08 and q17 accepted for question
scope; q23 marked partial; q34 confirmed partial. Raw judge outputs are unchanged.

## Limitations

- Generator and judge use the same model; judge verdicts may share biases.
- Reference answers sometimes contain facts beyond the question's scope.
- Page-level retrieval scores conceal missing facts and broken context.
- Citation support was primarily checked against extracted text, not every
  original PDF layout.
- Three unanswerable dev questions are only a refusal smoke test.
- Manual reference review is not independent clinical validation.

## Next

Dev baseline adjudication is complete. Test one retrieval change at a time.

Then test one change at a time:
1. Hybrid lexical + vector retrieval with Reciprocal Rank Fusion.
2. Dropping or merging tiny chunks.
3. Cross-encoder reranking.

Record improvements and regressions. Keep held-out questions untouched
until tuning is finished.

## Experiment 1 — BM25 + vector with RRF

- Same corpus, chunking and embedding model as baseline.
- BM25: heading + content, lowercase regex tokenization,
  BM25Okapi defaults.
- Retrieve 20 candidates per method; equal-weight RRF,
  constant 60; return top 5.

| Metric | Vector baseline | Hybrid |
|---|---|---|
| Hit@5 | 27/27 | 27/27 |
| MRR@5 | 0.907 | 0.915 |
| Mean page coverage@5 | 100% | 100% |
| All-required-pages@5 | 27/27 | 27/27 |

### Evidence spot checks
- q06: BM25 alone retrieved the required dose passage at rank 3,
  but fusion excluded it from the top 5.
- q28: full → partial coverage; starting dose, infusion rate and
  adjustment evidence lost, while stopping criteria remained.
- Full hybrid evidence and answer evaluations were not run.

### Decision
Do not adopt this configuration: page-level MRR improved slightly,
but q28 evidence coverage regressed and q06 remained unresolved.
App and retrieval evaluator retain vector search. Held-out untouched.

## Experiment 2 — Filter short chunks

- Vector search only; exclude content shorter than 30 characters
  after trimming, before ranking and LIMIT.
- Same corpus, embeddings and top 5; no re-ingestion.

| Metric | Baseline | Filtered |
|---|---|---|
| Hit@5 | 27/27 | 27/27 |
| MRR@5 | 0.907 | 0.926 |
| Mean page coverage@5 | 100% | 98.1% |
| All-required-pages@5 | 27/27 | 26/27 |
| Multi-part evidence: full / partial / none | 3 / 4 / 1 | 3 / 5 / 0 |

### Evidence review
- Reviewed all 8 multi-part dev questions.
- q32 improved from none to partial: asthma features retrieved,
  but COPD comparison remains missing.
- Other coverage categories unchanged.
- q26 lost the STEMI page match; previously useful evidence remained.
- q06 dose passage still missing from top 5.

### Answer and refusal evaluation

| Metric | Baseline | Filtered |
|---|---|---|
| Correct refusals | 3/3 | 3/3 |
| False refusals | 7/27 | 6/27 |
| Raw judge: correct / partial / incorrect | 14 / 5 / 8 | 16 / 4 / 7 |
| Manual review: correct / partial / incorrect | 15 / 4 / 8 | 16 / 4 / 7 |

All 27 answerable filtered responses reviewed; see
`filtered_answer_review.md`. Raw judge verdicts preserved.

### Decision

Do not adopt yet. q32 evidence improved, but its answer still refused.
q30 and q34 answered better with unchanged source text, so the answer
gains cannot be attributed to filtering from this single run.

App retains baseline vector search. Held-out untouched.

## Experiment 3 — Cross-encoder reranking

- Original vector search retrieves 20 candidates; no short-chunk filter
  or BM25.
- CPU model: cross-encoder/ms-marco-MiniLM-L6-v2.
- Scores question + chunk content pairs; returns top 5.
- No score threshold; chunk ID breaks score ties.

| Metric | Baseline | Reranked |
|---|---|---|
| Hit@5 | 27/27 | 27/27 |
| MRR@5 | 0.907 | 0.944 |
| Mean page coverage@5 | 100% | 100% |
| All-required-pages@5 | 27/27 | 27/27 |
| Multi-part evidence: full / partial / none | 3 / 4 / 1 | 4 / 4 / 0 |

### Evidence review
- All 8 multi-part dev questions reviewed.
- q30: partial → full; timing and transfer evidence retrieved.
- q32: none → partial; asthma features present, COPD comparison absent.
- q29: remains partial but loses useful red-flag evidence.
- Other coverage categories unchanged.
- Reranking cannot recover passages outside its 20 candidates;
  q06 remains unresolved by this candidate pool.

### Answer and refusal evaluation

| Metric | Baseline | Reranked |
|---|---|---|
| Correct refusals | 3/3 | 3/3 |
| False refusals | 7/27 | 4/27 |
| Raw judge: correct / partial / incorrect | 14 / 5 / 8 | 20 / 3 / 4 |
| Manual review: correct / partial / incorrect | 15 / 4 / 8 | 21 / 2 / 4 |

All 27 answerable responses manually reviewed; see
`reranked_answer_review.md`. Raw judge verdicts preserved.
q29 regressed from partial answer to refusal.

### Local retrieval latency

- Warm models, 27 answerable dev questions, one measurement per
  method/question; execution order alternated.
- Median vector retrieval: 839.9 ms.
- Median reranked retrieval: 1166.6 ms.
- Difference between unrounded medians: 326.8 ms.
- Includes database access; excludes generation and model loading.
- Laptop measurements do not establish Render latency or memory usage.

### Decision

Preferred candidate based on dev answer quality and local latency.
App still uses vector baseline; configuration finalization and
held-out evaluation remain pending.

Single answer-generation run per configuration; no repeatability
or statistical-significance claim. Held-out untouched.
