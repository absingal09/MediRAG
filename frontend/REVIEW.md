# Editorial Brief — review record

4 November 2026. All changes are confined to `frontend/`; no backend, evaluation, held-out data, deployment or `main` changes.

## Acceptance rule

Five independent agents evaluate the same unchanged candidate against their fixed checklists. Any UI/code revision resets all five reviews. Review waves may run sequentially due to concurrency limits; a round always refers to one candidate, not simultaneous execution.

| Reviewer | Round 1 | Round 2 |
|---|---|---|
| Visual design | Fail: selected passage not visible enough | Pass |
| Typography | Fail: small metadata, long prose lines | Pass |
| Interaction | Pass | Pass |
| Accessibility/layout | Fail: faint essential labels | Pass |
| Source/provenance | Fail: stale unknown PDF and silently clamped page | Pass |

**Round 2: all five passed one unchanged version.** No UI edits were made between the first and fifth verdict.

## Candidate identity

- `src/App.tsx` SHA-256: `C05C8A101F7BA7BBAAFE96D83851751BEB06232B2CAF26428D390BD456408A86`
- `src/App.css` SHA-256: `106517DB446EF3F8C12C120A9EDDAAD2231B0E34322C2351EF9BB81EA0015821`
- Local screenshots: `.qa/desktop-round2.png`, `.qa/mobile-round2.png`, `.qa/mobile-source-round2.png`. These QA artifacts are ignored by Git.

## Validation

- All 16 tests and the production build passed.
- Browser: library filtering/empty state, local-only PDF import, two-page document navigation, expanded reader, Escape/focus restoration, citation switch back to the correct PDF, arrow-key source tabs and offline API error clearing.
- Desktop 1440px and mobile 390px reported no horizontal page overflow.
- Mobile source drawer moves focus inside, wraps focus, makes background controls inert, locks background scrolling and restores focus on Escape.
- The example is clearly local/title metadata, not an API answer. Real PDFs are rendered without invented text highlights.

## Scope and remaining limits

These are scoped design, frontend behavior, code and provenance reviews—not clinical validation, a full WCAG audit or live LLM evaluation. The API was offline during browser verification; end-to-end model answers need the existing FastAPI/database running. Local PDF import previews a file only; server ingestion is not implemented. No exact passage highlight is drawn without source coordinates.

Nonblocking observation: the floating mobile Source notes control may overlap footer copy near the bottom. Reviewers accepted this candidate; changing its UI later starts a new review round if five-way acceptance is requested again.
# Citation connector follow-up (superseded by PDF-location correction below)

- Added a decorative cobalt arrow from the selected citation row, through the desktop gutter, to the document header. No PDF coordinates or highlights are inferred.
- Hidden on mobile and absent for refusals, errors, cleared selections or unavailable documents. Pointer input and keyboard navigation are unaffected.
- Verification: 17 tests and production build passed; desktop preview checked; at 390px the connector is hidden with no horizontal overflow.
- Five independent reviewers passed the same unchanged candidate in one round: visual, typography, interaction, accessibility and sources. The user clarified that the arrow must reach text inside the PDF; this header-only implementation was replaced.

## PDF-location correction

- Matches the complete retrieved passage uniquely against the cited PDF page's text; highlights measured text-item boxes and points the desktop arrow into the first matched line. Zoom, scroll and expanded-reader highlights verified using the Stroke example.
- No fuzzy, duplicate or short-fragment matches; unsupported rotated text and missing matches keep page access with an explicit unavailable-location message. No backend changes.
- Review round 1: visual, typography, interaction and accessibility PASS; sources FAIL because Unicode comparison symbols were removed during matching. Fixed normalization to preserve mathematical symbols and dose ranges, with regression tests.
- Review round 2: all five independent reviewers PASS on the same unchanged corrected candidate. 24 tests and production build pass. Mobile 390px retains source highlights, hides the cross-column arrow and has no horizontal overflow.
- This is passage location, not clinical validation or proof that each answer claim is supported. Historical acceptance notes above describe their original candidates.

