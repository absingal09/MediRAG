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