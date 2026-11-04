// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PdfPage } from "./PdfPage";
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
});
it("reports an unavailable requested page without drawing a substitute page", async () => {
  const onPages = vi.fn();
  render(<PdfPage url="/example.pdf" page={2} zoom={1} onPages={onPages} />);
  await screen.findByText("Page 2 is not available in this PDF (1 page).");
  expect(mocks.getPage).not.toHaveBeenCalled();
  await waitFor(() => expect(onPages).toHaveBeenCalledWith(1));
});
