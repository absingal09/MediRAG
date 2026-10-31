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

---

## Chunking findings (after building `app/chunking.py`)

- **Vertical watermark `stw.icmr.org.in`** in the 5 October 2019 PDFs (Asthma,
  Dengue, Headache, Sepsis, Stroke). One tall, thin block down the page edge:
  it overlapped every box vertically and was narrow enough to pass the
  overlap rule, so it glued whole columns together (Asthma: 7 chunks, one of
  3,836 characters mixing two tables, guiding principles and exacerbation
  management). Removed as boilerplate → Asthma 35 chunks, longest 1,606.
- **Headings spanning two columns** (MONITORING TREATMENT, COMMON
  ERRORS/PITFALLS) bridged the columns when any x-overlap counted. Fixed by
  requiring overlap ≥ 80% of the narrower block; `find_heading` then attaches
  the heading to every box below it instead.
- **Pitfalls now carry their heading**, so "Initiating insulin therapy before
  I/V fluid therapy" is labelled as an error, not read as an instruction.
- **Genuinely large boxes** (e.g. Aortic complications table, ~3,900 characters,
  returned as one block by PyMuPDF) exceeded the embedding limit; split at
  bullet boundaries into ≤ 800-character pieces.

### Known limitations
- Monitoring and Treatment both get the heading `MANAGEMENT MONITORING TREATMENT`
  (one heading block spans both columns).
- Some boxes get a nearby but wrong heading (DKA "Look & address for
  precipitating factors" gets "When to suspect DKA"); harmless when the box
  contains its own heading.
- Small flowchart items (e.g. "Pain abdomen") are 1-line chunks with only the
  document title as heading.
- Tables remain unsupported (see Decision).

---

## Retrieval observations (baseline: vector-only, all-MiniLM-L6-v2, 494 chunks)

First test, eval question q06: *"What dose of tenecteplase should a 75 kg STEMI patient receive?"*

- **Right document:** all top 5 results come from STW_STEMI. hit@5 would count this
  as a hit (single-page PDF), yet the answer was **not** retrieved. This is the
  DESIGN.md caveat in practice: hit@5 overstates quality here.
- **The dose is extracted correctly** (chunk 456: "Tenecteplase 35 mg IV bolus if
  60-70 Kg, 40 mg IV bolus if 70-80 Kg…") but it is **not in the top 20**.
  Heart-failure dose chunks (ARNI, furosemide) rank above it.

Causes:
1. **Mixed-topic chunk:** heparin, enoxaparin and tenecteplase share one chunk,
   so its vector is only weakly about tenecteplase.
2. **Wrong heading:** chunk 456 got "ABSOLUTE CONTRA-INDICATIONS TO THROMBOLYTIC
   THERAPY" (known `find_heading` limitation).
3. **Tiny fragment chunks rank high:** "Yes", "Immediately", "Rescue PCI",
   "Preferably within 30 mins". Their vector is mostly their heading, so they
   loosely match any STEMI question.
4. **Small embedding models under-weight rare terms and numbers:** "dose" + "mg"
   pulls in any dose chunk regardless of which drug was asked about.
5. **Bullet-less tables are cut mid-sentence** by `split_words`: chunk 456 ends
   "…45 mg IV bolus if more than", and the next chunk starts "80 Kg Reteplase…".


**Second test**, short query `tenecteplase dose` via `/search?k=3`: top 3 are
heart-failure doses (ARNI, furosemide) and a headache dose (indomethacin); no
STEMI chunk at all. The model has no useful representation of "tenecteplase"
(split into meaningless sub-word pieces), so the query reduces to "some dose".
Strongest case for hybrid keyword + vector search.

**Not fixed yet, on purpose:** the baseline eval will measure how common this is.
Candidate fixes, to test one at a time with before/after numbers:
- hybrid search (BM25 keyword + vector, merged with Reciprocal Rank Fusion)
- dropping or merging chunks under ~30 characters into their neighbour
- reranking the top 20 with a cross-encoder
- better heading assignment for boxes inside tables