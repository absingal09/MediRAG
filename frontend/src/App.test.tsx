// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { askQuestion } from "./api";
import type { AskResult } from "./types";

vi.mock("./api", () => ({ askQuestion: vi.fn() }));
vi.mock("./PdfReader", () => ({
  PdfPage: ({ url, page }: { url: string; page: number }) => (
    <div data-testid="pdf-reader">
      {url} · requested page {page}
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const result: AskResult = {
  answer: "Document response. [S1]",
  refused: false,
  citations: [{ doc_name: "STW_DKA", page_no: 1 }],
  sources: [
    {
      doc_name: "STW_DKA",
      page_no: 1,
      content: "Retrieved document text",
      heading: "Heading",
    },
  ],
};
function submit() {
  const question = screen.getByRole("textbox", { name: "YOUR QUESTION" });
  fireEvent.change(question, { target: { value: "A test question" } });
  fireEvent.submit(question.closest("form")!);
}
describe("answer and provenance states", () => {
  it("links a final citation to the selected document, page and retrieved passage", async () => {
    vi.mocked(askQuestion).mockResolvedValue(result);
    render(<App />);
    submit();
    await screen.findByText("Document response.");
    const citation = screen.getByRole("button", { name: /DKA · p\. 1/ });
    expect(citation.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("region", { name: "Selected source passage" })
        .textContent,
    ).toContain("Retrieved document text");
    expect(screen.getByTestId("pdf-reader").textContent).toContain(
      "STW_DKA.pdf · requested page 1",
    );
  });
  it("never substitutes a stale PDF for a missing source document", async () => {
    vi.mocked(askQuestion).mockResolvedValue({
      ...result,
      citations: [{ doc_name: "STW_Missing", page_no: 1 }],
      sources: [{ ...result.sources[0], doc_name: "STW_Missing" }],
    });
    render(<App />);
    submit();
    await screen.findByText("PDF not available in this library");
    expect(screen.queryByTestId("pdf-reader")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Open original PDF" }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: "Expand document reader",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen
        .getByRole("tab", { name: "Passage" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });
  it("preserves the requested page number instead of silently clamping it", async () => {
    vi.mocked(askQuestion).mockResolvedValue({
      ...result,
      citations: [{ doc_name: "STW_DKA", page_no: 2 }],
      sources: [{ ...result.sources[0], page_no: 2 }],
    });
    render(<App />);
    submit();
    await screen.findByText("Document response.");
    expect(screen.getByTestId("pdf-reader").textContent).toContain(
      "requested page 2",
    );
  });
  it("discards a previous answer and its citations when the next request fails", async () => {
    vi.mocked(askQuestion).mockRejectedValue(new Error("Connection failed"));
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Explore an interface example" }),
    );
    expect(screen.getByRole("button", { name: /DKA · p\. 1/ })).toBeTruthy();
    submit();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Connection failed",
    );
    expect(screen.queryByRole("button", { name: /DKA · p\. 1/ })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Selected source passage" }),
    ).toBeNull();
  });
  it("renders refusals without interactive answer citations", async () => {
    vi.mocked(askQuestion).mockResolvedValue({
      ...result,
      answer: "I couldn't find this in the guidelines.",
      refused: true,
      citations: [],
    });
    render(<App />);
    submit();
    await screen.findByText("I couldn't find this in the guidelines.");
    expect(screen.queryByRole("button", { name: /DKA · p\. 1/ })).toBeNull();
    expect(
      screen.queryByRole("region", { name: "Selected source passage" }),
    ).toBeNull();
  });
  it("keeps streamed citations noninteractive until the final event", async () => {
    let resolve!: (value: AskResult) => void;
    vi.mocked(askQuestion).mockImplementation(async (_question, onDelta) => {
      onDelta("Provisional text [S1]");
      return await new Promise<AskResult>((done) => {
        resolve = done;
      });
    });
    render(<App />);
    submit();
    await screen.findByText("Provisional text");
    expect(screen.queryByRole("button", { name: /DKA · p\. 1/ })).toBeNull();
    resolve(result);
    await waitFor(() =>
      expect(screen.queryByText("Provisional text")).toBeNull(),
    );
    expect(screen.getByRole("button", { name: /DKA · p\. 1/ })).toBeTruthy();
  });
});
