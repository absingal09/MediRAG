import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FileWarning, LoaderCircle } from "lucide-react";
import { matchSourceItems } from "./pdfSourceMatch";
GlobalWorkerOptions.workerSrc = workerUrl;
export function PdfPage({
  url,
  page,
  zoom,
  onPages,
  highlightText = "",
}: {
  url: string;
  page: number;
  zoom: number;
  onPages: (pages: number) => void;
  highlightText?: string;
}) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(480),
    [busy, setBusy] = useState(true);
  const [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [location, setLocation] = useState<{
    key: string;
    boxes: { left: number; top: number; width: number; height: number }[];
  } | null>(null);
  const locationKey = JSON.stringify([url, page, zoom, width, highlightText]);
  const boxes =
    !busy && !error && location?.key === locationKey ? location.boxes : [];
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(180, entry.contentRect.width - 32)),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    setPdf(null);
    const task = getDocument({ url });
    task.promise
      .then((document) => {
        if (active) {
          setPdf(document);
          onPages(document.numPages);
        }
      })
      .catch(() => {
        if (active) {
          setError("This PDF could not be opened.");
          setBusy(false);
        }
      });
    return () => {
      active = false;
      void task.destroy();
    };
  }, [url, retry, onPages]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let render: RenderTask | undefined;
    setError("");
    if (page < 1 || page > pdf.numPages) {
      setError(
        `Page ${page} is not available in this PDF (${pdf.numPages} ${pdf.numPages === 1 ? "page" : "pages"}).`,
      );
      setBusy(false);
      return;
    }
    setBusy(true);
    pdf
      .getPage(page)
      .then(async (documentPage) => {
        if (!active || !canvas.current) return;
        const viewport = documentPage.getViewport({
          scale: (width / documentPage.getViewport({ scale: 1 }).width) * zoom,
        });
        const ratio = Math.min(window.devicePixelRatio || 1, 2),
          surface = canvas.current;
        surface.width = Math.floor(viewport.width * ratio);
        surface.height = Math.floor(viewport.height * ratio);
        surface.style.width = `${viewport.width}px`;
        surface.style.height = `${viewport.height}px`;
        const context = surface.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        render = documentPage.render({
          canvas: surface,
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        await render.promise;
        let matchedBoxes: NonNullable<typeof location>["boxes"] = [];
        if (highlightText && documentPage.rotate === 0) {
          try {
            const text = await documentPage.getTextContent();
            const items = text.items.filter(
              (item): item is Extract<typeof item, { str: string }> =>
                "str" in item,
            );
            const indices = matchSourceItems(items, highlightText);
            // Only horizontal text has supported geometry. Fail closed otherwise.
            if (
              indices.every((index) => {
                const t = items[index].transform;
                return (
                  Math.abs(t[1]) < 0.001 &&
                  Math.abs(t[2]) < 0.001 &&
                  t[0] > 0 &&
                  t[3] > 0
                );
              })
            ) {
              matchedBoxes = indices
                .map((index) => {
                  const item = items[index];
                  const [left, baseline] = viewport.convertToViewportPoint(
                    item.transform[4],
                    item.transform[5],
                  );
                  const height = item.height * viewport.scale;
                  return {
                    left,
                    top: baseline - height,
                    width: item.width * viewport.scale,
                    height,
                  };
                })
                .filter((box) => box.width > 0 && box.height > 0);
            }
          } catch {
            // Text extraction failure must not prevent reading the original page.
          }
        }
        if (active) setLocation({ key: locationKey, boxes: matchedBoxes });
      })
      .then(() => {
        if (active) setBusy(false);
      })
      .catch((reason) => {
        if (active && reason?.name !== "RenderingCancelledException") {
          setError("This page could not be rendered.");
          setBusy(false);
        }
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [pdf, page, width, zoom, highlightText, locationKey]);
  useEffect(() => {
    if (!boxes.length || !host.current) return;
    const target = host.current.querySelector<HTMLElement>(".pdf-match");
    if (!target) return;
    const viewport = host.current.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    host.current.scrollTop +=
      rect.top - viewport.top - host.current.clientHeight / 2;
    host.current.scrollLeft +=
      rect.left - viewport.left - host.current.clientWidth / 3;
  }, [location, busy, boxes.length]);
  return (
    <div className="pdf-surface" ref={host} aria-busy={busy}>
      {busy && !error && (
        <div className="pdf-state">
          <LoaderCircle className="spin" size={21} />
          <span>Opening source page…</span>
        </div>
      )}
      {error && (
        <div className="pdf-state">
          <FileWarning size={25} />
          <span>{error}</span>
          <button
            className="text-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {!busy && !error && highlightText && (
        <p className="pdf-location-note" role="status">
          {boxes.length
            ? "Matched source passage highlighted below."
            : "Exact passage location unavailable; showing the cited page."}
        </p>
      )}
      <div className="pdf-page-frame" style={{ width: width * zoom }}>
        <canvas
          ref={canvas}
          role="img"
          aria-label={`PDF source, page ${page}. Use Open original to read or search the accessible PDF.`}
          style={{
            display: error ? "none" : "block",
            visibility: busy ? "hidden" : "visible",
          }}
        />
        {boxes.map((box, index) => (
          <span
            key={index}
            className="pdf-match"
            aria-hidden="true"
            style={box}
          />
        ))}
      </div>
    </div>
  );
}
