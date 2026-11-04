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

Tests mock the API/PDF engine; they do not call an LLM or read eval questions. Browser checks use the local interface example and actual local PDFs.

For deployment later, set `VITE_API_BASE_URL` at build time or configure an `/api` reverse proxy. The dev proxy is not a production server. Preserve the `documents/` assets in the built output.

## Current limits

Source metadata provides pages, not highlight coordinates. The reader locates a unique complete passage in the PDF's own text and uses its measured text-item coordinates to highlight it. On desktop, the blue connector points into that passage. If matching is missing, ambiguous, too short, or uses unsupported rotated text, the cited page remains available without a highlight or arrow. Layout whitespace is normalized; numeric operators and dose ranges are preserved. Highlights locate the retrieved passage, not independently verified support for each generated claim. See `REVIEW.md` for review scope and `WORK_CHECKPOINT.md` for the historical handoff.
