# Filtered retrieval — manual answer review

Reviewed all 27 answerable dev responses against references and cited text,
using the baseline manual rubric. Raw judge verdicts remain unchanged.

| Verdict | Count | IDs |
|---|---|---|
| Correct | 16/27 | q02, q04, q05, q08, q09, q11, q12, q13, q17, q18, q19, q25, q26, q27, q28, q34 |
| Partial | 4/27 | q23, q29, q30, q35 |
| Incorrect | 7/27 | q01, q06, q15, q16, q21, q22, q32 |

## Manual decisions
- q08/q17: accepted for asked scope, as in baseline.
- q23: partial; pain-migration destination remains unclear.
- q35: partial; USG assessment/drainage omitted. Judge applied
  the rubric inconsistently between runs.
- q30: partial; classification supported, timing missing.
  Document-wide absence claim exceeds retrieved evidence.
- q34: correct; both regimens and APTT target supported.
- q22: still substitutes special-case targets.
- q29: incomplete red flags; cited text does not establish the SAH link.
- q12: same interleaved source as baseline; prior PDF verification applies.

## Comparison
Manual results: baseline 15/4/8 → filtered 16/4/7.
Correct refusals remain 3/3; false refusals fall from 7/27 to 6/27.

q30 and q34 have unchanged ordered source text, ignoring whitespace.
Their better answers cannot be attributed to filtering from this single run.
q32 retrieved more evidence but still refused.

Filter remains experimental; app retains vector baseline. Held-out untouched.
