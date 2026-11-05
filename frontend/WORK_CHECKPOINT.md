# Frontend work checkpoint — 4 November 2026

**Historical checkpoint: the status and pending checks below describe 4 November 2026. For completed frontend work and subsequent live API verification, see Phase 10 of `../docs/BUILD_LOG.md`.**

## Authorization and stopping rule

- User authorizes autonomous frontend-only edits and commits on `frontend`.
- Do not modify backend/evaluation files, look at held-out questions, merge into `main`, deploy or consume rate-limit reset credits.
- Pause at 5% remaining five-hour allowance. A one-shot continuation is scheduled in this chat for 9:11 PM IST after the 9:10 PM reset.
- Check current allowance on resume; preserve the user's stopping rule.

## Built

Editorial Brief React/Vite implementation in this directory: library, real PDFs, one question form, SSE API adapter, source notes, citation navigation, expanded reader and local PDF preview (not ingestion). All changes confined to `frontend/`. Fonts are bundled locally.

## Verified / still pending

- 16 unit/contract tests passed (API stream parsing, interrupted/error/refusal states, citation metadata, unknown sources and unavailable pages).
- All 16 tests and the production build passed after the PDF-switch fix and source formatting. PDF code is lazy-loaded; no oversized-entry warning remains.
- Browser verified library filtering/empty state, aortic syndrome page 2, expanded reader, Escape restoring focus and citation navigation.
- That last switch exposed a PDF canvas error. Fixed by remounting the reader for URL changes and retaining the canvas through error states. Browser recheck passed after reset (aortic page 2 → expanded reader → Escape → DKA citation page 1).
- Backend port 8000 is offline. No live model request made. Live end-to-end API behavior remains unverified.
- Offline error clearing, mobile drawer/overflow, keyboard tab selection and local import checked after reset. Final desktop example and mobile views captured in `.qa/`; these are ignored local artifacts.
- Local preview server runs in session 29628 at http://127.0.0.1:5173/ (restart with `npm run dev` if absent). Browser preview is an agent-created IAB tab; viewport currently 1440x1000 for desktop testing. Reset temporary viewport before handoff.

## Strict five-reviewer gauntlet

The user requires **all five reviewers to PASS the same unchanged candidate in one round**. Any UI fix resets all five reviews. Review agents are independent; concurrency may require sequential waves.

| Agent                     | Frozen criteria                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `editorial_visual`        | hierarchy, restrained ivory/cobalt finish, usable answer/source proportions, selected source connection, polished unclipped UI                  |
| `editorial_typography`    | serif title/sans body, readable metadata/control scale, ~45–85 character prose measure, clear doc/page references, spacing                      |
| `editorial_interaction`   | one composer, retained question/coherent answer, selected citation to actual source, honest state labels, library access                        |
| `editorial_accessibility` | legibility, labeled controls/focus, non-color selection cues, no desktop overflow, semantic keyboard behavior                                   |
| `editorial_sources`       | exact document/page mapping, distinct retrieved/generated text, no stale refusal/error cites, honest example labels, no invented PDF highlights |

Round 1: visual FAIL (selected passage not prominent), typography FAIL (9–11px metadata and long prose), interaction PASS, accessibility FAIL (faint small metadata), sources FAIL (unknown doc showed stale PDF; requested unavailable page was clamped).

All identified issues were addressed: visible selected-passage section; essential metadata >=12px; prose16px/68ch; unknown PDFs suppressed; requested pages preserved and explicitly rejected when unavailable. **Round 2: visual, typography, interaction, accessibility and sources all PASS on the same unchanged candidate.**

Round-1 screenshot: `.qa/desktop-round1.png` (ignored). Final screenshots/review evidence can remain in `.qa/`. For round 2, give all five the same screenshot paths and source snapshot; do not change app code until all report. Maintain complete honest review results.

## Next

Frontend acceptance is complete within its documented scope. Code and review documentation are committed separately on `frontend`. Await the user's design feedback; do not merge or deploy. A future live API smoke check needs the existing backend/database running. Leave backend/evals untouched.

## Paused checkpoint

Allowance reached **95% used / 5% remaining** before reset. Work stopped at the user's threshold, then resumed through the one-shot automation after the reset. The continuation has completed and its automation is removed; no ongoing monitor remains. Preserve the user's 5%-remaining stopping rule for future work. No reset credits were consumed.
