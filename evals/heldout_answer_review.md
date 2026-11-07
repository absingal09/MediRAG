# Held-out reranked retrieval — manual answer review

All 8 answerable held-out responses reviewed against their references and
cited passages using the baseline manual rubric. Frozen retrieval and
generation configuration unchanged; raw judge verdicts preserved.

| ID | Judge | Manual review | Reason |
|---|---|---|---|
| q03 | correct | Correct; citation supported | S1 supports the glucose threshold, dextrose concentration and rate. |
| q07 | correct | Correct; citation supported | S1 supports ECG timing after starting thrombolysis and both success criteria. |
| q10 | correct | Correct with wording caveat | S1 supports frequency, trial duration and both drug doses. S2/S3 support the extra statements. “And” is read as listing options, but does not clearly preserve the reference's alternative-versus-combination distinction. |
| q14 | correct | Correct; citation supported | S2 supports the fever drug and the instruction to avoid NSAIDs. |
| q20 | incorrect | Incorrect; required evidence not retrieved | Refused. Retrieved table labels and follow-up text do not contain the required asthma-control criteria. Extraction versus retrieval cause is unresolved. |
| q24 | correct | Correct; citation supported | S1 supports the initial dose, repeat interval, oral alternatives and stopping condition. Added oral esomeprazole is supported. |
| q31 | incorrect | Incorrect; required evidence not retrieved | Refused. Top 5 contain dengue fragments without discharge criteria; the paediatric sepsis page is absent. |
| q33 | incorrect | Incorrect; required evidence not retrieved | Refused. Top 5 lack transfusion thresholds and the requested resuscitation targets. |

## Results

- Manual and raw judge results: **5 correct, 0 partial, 3 incorrect**.
- All 3 incorrect answers are false refusals on answerable questions.
- The separate unanswerable evaluation recorded **2/2 correct refusals**;
  those responses are saved but excluded from answer-correctness judging.
- Refusing unsupported retrieved context avoids guessing, but remains an
  end-to-end failure when the reference establishes that the question is answerable.

## Limits

Review primarily checks extracted passages, not every original PDF layout.
q10's ambiguous alternative-versus-combination wording remains recorded.
This is one held-out run, not independent clinical validation.
No tuning or configuration changes followed inspection of these results.
