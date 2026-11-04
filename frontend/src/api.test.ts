import { afterEach, describe, expect, it, vi } from "vitest";
import { askQuestion } from "./api";

const result = {
  answer: "Example [S1]",
  refused: false,
  citations: [{ doc_name: "STW_DKA", page_no: 1 }],
  sources: [
    { doc_name: "STW_DKA", page_no: 1, heading: "", content: "Example source" },
  ],
};
const event = (type: string, data: unknown) =>
  `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
const signal = () => new AbortController().signal;
function mockStream(chunks: string[]) {
  const encoder = new TextEncoder();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (const chunk of chunks)
                controller.enqueue(encoder.encode(chunk));
              controller.close();
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
    ),
  );
}
afterEach(() => vi.unstubAllGlobals());
describe("POST SSE contract", () => {
  it("joins fragments and replaces the draft with the authoritative final", async () => {
    mockStream([
      event("delta", { text: "Old " }),
      event("delta", { text: "draft" }),
      event("final", result),
    ]);
    const delta = vi.fn();
    expect(await askQuestion("A question", delta, signal())).toEqual(result);
    expect(delta.mock.calls).toEqual([["Old "], ["Old draft"]]);
    expect(fetch).toHaveBeenCalledWith(
      "/api/ask/stream",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ question: "A question" }),
      }),
    );
  });
  it("handles cached responses containing only a final event", async () => {
    mockStream([event("final", result)]);
    const delta = vi.fn();
    expect(await askQuestion("A question", delta, signal())).toEqual(result);
    expect(delta).not.toHaveBeenCalled();
  });
  it("handles arbitrary chunk boundaries including a split CRLF", async () => {
    const stream = event("final", result).replaceAll("\n", "\r\n");
    mockStream(Array.from(stream));
    expect(await askQuestion("A question", vi.fn(), signal())).toEqual(result);
  });
  it("rejects provider error events after a provisional draft", async () => {
    mockStream([
      event("delta", { text: "Untrusted draft" }),
      event("error", { message: "Failed" }),
    ]);
    await expect(askQuestion("A question", vi.fn(), signal())).rejects.toThrow(
      "draft has been discarded",
    );
  });
  it("rejects EOF without final instead of accepting a partial answer", async () => {
    mockStream([event("delta", { text: "Partial answer" })]);
    await expect(askQuestion("A question", vi.fn(), signal())).rejects.toThrow(
      "before a final answer",
    );
  });
  it("preserves a normalized refusal without fabricating citations", async () => {
    const refusal = {
      ...result,
      answer: "Not found in the guidelines.",
      refused: true,
      citations: [],
    };
    mockStream([event("final", refusal)]);
    expect(await askQuestion("A question", vi.fn(), signal())).toEqual(refusal);
  });
  it("rejects malformed source metadata", async () => {
    mockStream([
      event("final", {
        ...result,
        sources: [{ doc_name: "STW_DKA", page_no: 0, content: "Bad page" }],
      }),
    ]);
    await expect(askQuestion("A question", vi.fn(), signal())).rejects.toThrow(
      "incomplete answer",
    );
  });
  it("reports HTTP failure without attempting to parse SSE", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unavailable", { status: 503 })),
    );
    await expect(askQuestion("A question", vi.fn(), signal())).rejects.toThrow(
      "HTTP 503",
    );
  });
  it("propagates aborts for the UI to discard provisional state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("Aborted", "AbortError");
      }),
    );
    await expect(
      askQuestion("A question", vi.fn(), signal()),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
