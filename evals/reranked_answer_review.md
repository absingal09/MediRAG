# Reranked retrieval — manual answer review

All 27 answerable dev responses reviewed against references and cited
passages using the baseline manual rubric. Raw judge verdicts preserved.

| Verdict | Baseline | Reranked |
|---|---|---|
| Correct | 15/27 | 21/27 |
| Partial | 4/27 | 2/27 |
| Incorrect | 8/27 | 4/27 |

## Findings
- Partial: q23 (unclear pain migration), q35 (USG/drainage omitted).
- Incorrect/refused: q06, q15, q29, q32.
- q01/q16/q21: previously missing facts retrieved and correctly cited.
- q22: requested BP/HR targets correct; added special-case targets
  labelled and supported. Pain control/beta-blocker details are outside
  the explicit target question.
- q30: classification, urgent timing and transfer supported.
- q34: both regimens and APTT target supported.
- q29 regressed from partial to refusal after losing useful evidence.
- q08/q17 accepted for asked scope; q08 onset anchor remains implicit.
- q12 retains the prior original-PDF verification and extraction caveat.
- Other reviewed answers match the reference scope and cited text.

## Refusals
- Correct refusals: 3/3.
- False refusals: 4/27, compared with 7/27 baseline.

## Limits
Single generation/judging run per configuration; no repeatability claim.
Evidence review uses extracted passages, with the noted q12 PDF check.
Warm local median retrieval: vector 839.9 ms, reranked 1166.6 ms.
Reranking was selected and frozen for the completed held-out evaluation;
see `heldout_answer_review.md` and `results.md`. Deployment remains pending:
the app still uses vector baseline, and Render latency/memory are unverified.
