# Extraction audit

Goal: find out which extraction method keeps the flowchart PDFs readable
**before** writing the parser. If extraction loses which condition an instruction
belongs to, good retrieval can still produce a misleading answer.

Script: `scripts/inspect_pdf.py <pdf>` prints each PDF three ways:
1. **plain**: `page.get_text()`
2. **blocks**: `page.get_text("blocks")`, sorted by position (y, then x)
3. **markdown**: `pymupdf4llm.to_markdown(path)`

---

## STW_DKA (1 page) – done

| Method | Headings | Side-by-side columns | Severity table | Verdict |
|---|---|---|---|---|
| plain | Appear **after** their content | Monitoring, Treatment and Pitfalls run together | Scrambled column by column | ❌ |
| blocks, sorted by y | Correct for full-width sections | Columns **interleaved** line by line (Monitoring ↔ Treatment) | Cells split into separate blocks | ❌ |
| pymupdf4llm | Correct, marked with `#` levels | Mostly separated; Pitfalls and Investigations still interleaved | Rows rebuilt as text (`pH 7.25-7.3 7.0-7.25 <7.0`) | ✅ best |

### Findings
- **Plain text is dangerous:** "Initiating insulin therapy before I/V fluid therapy"
  is a *pitfall* (an error to avoid), but in plain text it sits right after the
  treatment steps and reads like an instruction.
- **Coordinates help:** blocks carry (x0, y0, x1, y1). Headings sit directly
  above their content even when the PDF's internal order is wrong. Sorting by y
  fixes full-width sections but interleaves side-by-side columns.
- **pymupdf4llm** does layout analysis and keeps headings in front of their
  content, so **chunking by Markdown heading is possible**.

### Problems left with pymupdf4llm
1. **Top region treated as a picture:** symptoms, Assess and the severity
   table come out as one `<br>`-joined line, interleaved. The heading
   "WHEN TO SUSPECT DKA…" lands after that content.
2. **Side-by-side boxes still interleave:** Precipitating factors ↔ Investigations,
   and the two-column **Pitfalls** list is woven together mid-sentence (unreadable).
3. **Noise to strip:** the legal disclaimer (same in every PDF) and the abbreviations block.
4. Warning `RapidOCR is missing`: not needed, since the PDF has a real text layer.

### Effect on eval questions
- q01, q02, q03, q28 (fluids, potassium, dextrose, insulin) come from
  Treatment / When to stop, which extract **cleanly**.
- Questions on Pitfalls or the severity table would currently be **unsupported**.
  None of the 40 questions depend on them.

---

## STW_NSTEMI (1 page) – done

The densest PDF. **pymupdf4llm fails badly here; blocks work.**

| Method | Result |
|---|---|
| pymupdf4llm | 3-column Management table (PHC / District / Tertiary) woven together row by row. Everything below is one "picture" blob. **Doses attached to the wrong drug**: clopidogrel line ends with metoprolol's "Short acting 25-100 mg BD"; ticagrelor's "BD" split off; heparin/APTT interleaved with nitroglycerine. ❌ |
| blocks | **Each block's own text is clean.** Anti-platelets (aspirin, clopidogrel, prasugrel, ticagrelor 90 mg BD) form one block; metoprolol/nitrates a separate block; heparin + APTT 50-70 sec intact; each hospital level its own block; risk categories intact. ✅ |

Remaining issues with blocks:
1. A section label sometimes sits at the **end of the block above** its content
   (`Anti thrombotics:`, `Statins:`, `Ace-inhibitor`).
2. One box can span **several blocks** (PHC column continues in 3 more blocks;
   statin dose split `Rosuvastatin` / `20-40 mg OD`).
3. **GRACE table:** one block per column; unusable as-is.
4. "Angina unlikely if" grid: scattered small fragments.

Eval questions at risk with pymupdf4llm (q05, q27, q30, q34) are clean with blocks.

## STW_Acute_Aortic_Syndrome (2 pages) – done

| Area | Blocks result |
|---|---|
| Prose sections (classification, presentation, imaging, Type A/B management) | Clean ✅ |
| Medical targets (SBP 100-120, HR 60-70) | One clean block ✅ (q22) |
| "Thrombolytic therapy should NOT be initiated" | Clean block on page 1 ✅ (q26) |
| Complications table, Diagnostic methods table | One block each, rows readable after collapsing whitespace ⚠️ |
| **Antihypertensive drug table** | Drug names, doses and contraindications are separate column blocks, and a dose block **spans two rows** ("Maintenance: 1-2 mg/minute" (Labetalol) + "Loading: 250-500 μg/kg" (Esmolol) in one block). **Dose misattribution risk.** ❌ |
| Flowchart (Targets achieved? Yes/No) | Fragmented ⚠️ |

Also: two headings merged in one block ("MI vs Type A dissection" + "Diagnostic imaging"),
and "Predisposing factors" again at the end of the block above its content.
Page 2 coordinates restart at the top, so **the page number must be stored per block**.

---

## Decision

- **Extraction method: `page.get_text("blocks")`.** A block's own text is clean;
  pymupdf4llm merges text across columns and attaches doses to the wrong drug.
- **Never merge text from different columns.** That is exactly what broke
  plain text, sorted blocks and pymupdf4llm.
- **Chunking (baseline):** group blocks into "boxes": same column (overlapping
  x-range) and vertically close (small y gap). One box = one chunk, with
  `doc_name` and `page_no`. Split boxes that exceed the token limit.
- **Clean-up:** collapse whitespace runs; strip boilerplate (disclaimer, "Department
  of Health Research / Ministry…" header, edition date, references, abbreviations).
- **Tables are unsupported for now:** DKA severity table, NSTEMI GRACE table, Aortic
  antihypertensive drug table. None of the 40 eval questions depend on them. Flag
  in the README; possible later fix: rebuild rows by grouping cells with the same y.
- **Later improvement:** move a short trailing label ending in ":" (e.g.
  `Statins:`) to the start of the next block in the same column.