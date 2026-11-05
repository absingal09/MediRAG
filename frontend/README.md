# MediRAG frontend — Editorial Brief

React + TypeScript + Vite, built on the `frontend` branch. Backend code and evaluation data are unchanged.

## Local development

From this directory:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:5173/. For generated answers, run the existing FastAPI app separately on port 8000, with its database running. Vite proxies `/api` to that API; no browser API key is needed. Set `MEDIRAG_API_TARGET` before starting Vite to change the local proxy target.

## Implemented

- One question form and progressively streamed answers. Only final metadata enables citations; errors and cancellation discard the provisional draft.
- Document/page citations open the matching PDF and show its retrieved passage separately. Missing documents or invalid page numbers do not silently substitute a different source.
- A searchable library of the 14 existing workflows, real PDF rendering, page navigation, zoom and expanded reader.
- Responsive source drawer, keyboard-operable dialogs/tabs and visible focus states.
- Explicitly labelled local interface example, usable without the API.
- Local PDF import for browser preview only. It does **not** upload, ingest or add documents to retrieval: the backend has no ingestion endpoint.

The Vite corpus plugin reads `../data/sources.csv` and allowlists the existing PDFs. Builds include those PDFs as static assets; development never exposes arbitrary repository files or `.env`.

## Checks

```powershell
npm test
npm run build
```

Tests mock the API/PDF engine; they do not call an LLM or read eval questions. Browser checks cover the local interface example, actual PDFs and live
FastAPI answers, including citation switching, refusal, caching and errors.

For deployment later, set `VITE_API_BASE_URL` at build time or configure an `/api` reverse proxy. The dev proxy is not a production server. Preserve the `documents/` assets in the built output.

## Current limits

Click any answer citation to open its document/page and highlight that retrieved passage. Different citations on the same page select different passages. There is no connecting arrow.

The frontend location index covers all 494 current chunks across the 14 PDFs. It reuses the existing read-only PyMuPDF parsing/chunking code to record original character coordinates; it does not change ingestion, retrieval or the database. Matching uses document, page, heading and complete chunk text, with only Unicode/whitespace normalization. Vite verifies PDF hashes so an outdated index cannot silently accompany changed PDFs.

After changing corpus PDFs or chunking, regenerate the frontend index from the repository root before starting/building Vite:

```powershell
.\.venv\Scripts\python.exe frontend/scripts/build_source_locations.py
```

For text outside the index, such as the saved interface example, the reader still attempts a unique PDF-text match. Unsupported or unlocatable text keeps access to the cited page with an explicit unavailable-location message. Highlights locate retrieved text; they do not independently verify each generated claim. See `REVIEW.md` for acceptance scope.
