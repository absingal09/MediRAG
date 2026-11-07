# Fresh 50-question supplementary evaluation

## Fixed before generation

- 30 direct questions, 10 multi-part questions, 10 unanswerable questions.
- All 14 existing ICMR workflows represented. References come from the original
  PDFs, not from retrieval rankings or model answers. Evidence quotes are checked
  against normalized original PDF page text; layout-sensitive mappings are also
  visually checked. The old 40-question set and its results are preserved.
- Questions use new requested facts/scopes rather than exact paraphrases of old
  questions. This is an assistant-authored supplementary test on a previously seen
  corpus, **not an independent or blinded clinical benchmark**. Document/topic
  overlap and correlated questions limit generalization.
- No question is selected, dropped or rewritten after inspecting its output.
- Freeze questions, this protocol, judge instructions, application source hashes,
  installed package versions, corpus PDF hashes, database chunk content hash,
  non-secret model settings and Git revision before the first generation call.
- Test the current `ask()` implementation: vector top 20, cross-encoder top 5,
  current prompt, validation retry and configured model fallback. Bypass answer
  cache. Do not change production code, retrieval, model settings or prompts.
- Preserve one successful generation per question, including incomplete answers
  and refusals. Transport failures are logged separately and may be resumed;
  completed answers are never regenerated to improve their score.

## Scoring

- Primary answer correctness: correct / **all 40 answerable questions**.
- Correct: all explicitly listed required facts conveyed with correct conditions,
  quantities, units, routes and timing, with no required-fact contradiction.
- Partial: at least one required fact conveyed, others missing, none contradicted.
- Incorrect: refusal of an answerable question, any required-fact contradiction,
  unrelated answer, or no required facts conveyed.
- Equivalent wording and equivalent units are accepted. OD/BD/TID/HS may be
  expressed as once daily/twice daily/three times daily/at bedtime.
- Do not demand unasked-for reference details. Required facts in the frozen
  dataset define the scope. Extra claims are reviewed against retrieved evidence
  and original PDFs; unsupported claims and citation support are reported
  separately and never quietly ignored or used to inflate correctness.
- Correct refusal: an unanswerable question is refused without providing the
  requested unsupported regimen. Report **correct refusals / 10** separately.
- Report false refusals / 40 and direct/multi answer scores separately.
- Retrieval metrics (hit@5, MRR@5, mean source-page coverage and all-pages@5)
  use saved sources from the same generation, not a second retrieval run.
  A correct page does not establish answer-bearing evidence.
- LLM judging uses the frozen required facts. Preserve raw judge text and derive
  verdicts from per-fact support and contradictions. Refusals are scored directly.
- Review all 50 outputs, all partial/incorrect labels and all extra-claim flags.
  Record any assistant adjudication with reasons separately; never overwrite raw
  judge verdicts. This is not human clinical validation.
- Report exact counts, denominators, run failures, observed model/fallback use,
  and limitations. Do not combine these questions with the original held-out
  score or claim a before/after improvement without a matched baseline run.

## Execution

From the repository root, using the existing virtual environment:

```powershell
.venv\Scripts\python.exe -m scripts.eval_fresh50 --freeze
.venv\Scripts\python.exe -m scripts.eval_fresh50 --run
.venv\Scripts\python.exe -m scripts.eval_fresh50 --judge
.venv\Scripts\python.exe -m scripts.eval_fresh50 --summary
```

The runner verifies the frozen configuration before resuming. It saves after each
question, does not send reference answers to the answer generator, and does not
change the application or database. Results belong only in this directory.
