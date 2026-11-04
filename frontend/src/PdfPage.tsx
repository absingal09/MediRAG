import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { FileWarning, LoaderCircle } from "lucide-react";
GlobalWorkerOptions.workerSrc = workerUrl;
export function PdfPage({
  url,
  page,
  zoom,
  onPages,
}: {
  url: string;
  page: number;
  zoom: number;
  onPages: (pages: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [width, setWidth] = useState(480),
    [busy, setBusy] = useState(true);
  const [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
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
      .then((documentPage) => {
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
        return render.promise;
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
  }, [pdf, page, width, zoom]);
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
      <canvas
        ref={canvas}
        role="img"
        aria-label={`PDF source, page ${page}. Use Open original to read or search the accessible PDF.`}
        style={{
          display: error ? "none" : "block",
          visibility: busy ? "hidden" : "visible",
        }}
      />
    </div>
  );
}
