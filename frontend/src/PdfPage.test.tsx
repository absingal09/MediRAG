// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PdfPage } from "./PdfPage";
import locationData from "./generated/sourceLocations.json";
const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), getPage: vi.fn() }));
vi.mock("pdfjs-dist", () => ({
  getDocument: mocks.getDocument,
  GlobalWorkerOptions: {},
}));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  mocks.getDocument.mockReturnValue({
    promise: Promise.resolve({ numPages: 1, getPage: mocks.getPage }),
    destroy: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("draws measured source text boxes and removes them when the passage no longer matches", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  const renderPage = vi.fn(() => ({
    promise: Promise.resolve(),
    cancel: vi.fn(),
  }));
  mocks.getPage.mockResolvedValue({
    rotate: 0,
    getViewport: () => ({
      width: 480,
      height: 600,
      scale: 1,
      convertToViewportPoint: (x: number, y: number) => [x, 600 - y],
    }),
    render: renderPage,
    getTextContent: async () => ({
      items: [
        {
          str: "BALANCE: Loss of balance or coordination",
          transform: [10, 0, 0, 10, 40, 500],
          width: 180,
          height: 10,
        },
      ],
    }),
  });
  const onPages = vi.fn();
  const { container, rerender } = render(
    <PdfPage
      url="/example.pdf"
      page={1}
      zoom={1}
      onPages={onPages}
      highlightText="BALANCE: Loss of balance or coordination"
    />,
  );
  await screen.findByText("Matched source passage highlighted below.");
  const box = container.querySelector<HTMLElement>(".pdf-match");
  expect(box?.style.left).toBe("40px");
  expect(box?.style.top).toBe("90px");
  rerender(
    <PdfPage
      url="/example.pdf"
      page={1}
      zoom={1}
      onPages={onPages}
      highlightText="This evidence is missing from the source PDF"
    />,
  );
  expect(container.querySelector(".pdf-match")).toBeNull();
  await screen.findByText(
    "Exact passage location unavailable; showing the cited page.",
  );
  expect(container.querySelector(".pdf-match")).toBeNull();
});

it("uses extraction coordinates for each selected chunk on the same PDF page", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  const getTextContent = vi.fn(() => {
    throw new Error("PDF.js reading order must not be needed");
  });
  mocks.getPage.mockResolvedValue({
    rotate: 0,
    getViewport: () => ({ width: 480, height: 600, scale: 1 }),
    render: () => ({ promise: Promise.resolve(), cancel: vi.fn() }),
    getTextContent,
  });
  const passages = locationData.locations
    .filter((location) => location.doc === "STW_DKA" && location.page === 1)
    .slice(0, 2);
  const onPages = vi.fn();
  const { container, rerender } = render(
    <PdfPage
      url="/documents/STW_DKA.pdf"
      page={1}
      zoom={1}
      onPages={onPages}
      sourceDoc="STW_DKA"
      sourceHeading={passages[0].heading}
      highlightText={passages[0].content}
    />,
  );
  await screen.findByText("Matched source passage highlighted below.");
  const firstLeft =
    container.querySelector<HTMLElement>(".pdf-match")!.style.left;
  expect(parseFloat(firstLeft)).toBeCloseTo(passages[0].rects[0][0] * 480);
  rerender(
    <PdfPage
      url="/documents/STW_DKA.pdf"
      page={1}
      zoom={1}
      onPages={onPages}
      sourceDoc="STW_DKA"
      sourceHeading={passages[1].heading}
      highlightText={passages[1].content}
    />,
  );
  expect(container.querySelector(".pdf-match")).toBeNull();
  await screen.findByText("Matched source passage highlighted below.");
  const secondLeft =
    container.querySelector<HTMLElement>(".pdf-match")!.style.left;
  expect(parseFloat(secondLeft)).toBeCloseTo(passages[1].rects[0][0] * 480);
  expect(getTextContent).not.toHaveBeenCalled();
});
it("reports an unavailable requested page without drawing a substitute page", async () => {
  const onPages = vi.fn();
  render(<PdfPage url="/example.pdf" page={2} zoom={1} onPages={onPages} />);
  await screen.findByText("Page 2 is not available in this PDF (1 page).");
  expect(mocks.getPage).not.toHaveBeenCalled();
  await waitFor(() => expect(onPages).toHaveBeenCalledWith(1));
});
