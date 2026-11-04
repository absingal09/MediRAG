import type { AskResult } from "./types";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(
  /\/$/,
  "",
);
function isResult(value: unknown): value is AskResult {
  if (!value || typeof value !== "object") return false;
  const data = value as AskResult;
  return (
    typeof data.answer === "string" &&
    typeof data.refused === "boolean" &&
    Array.isArray(data.citations) &&
    Array.isArray(data.sources) &&
    data.citations.every(
      (c) =>
        typeof c.doc_name === "string" &&
        Number.isInteger(c.page_no) &&
        c.page_no > 0,
    ) &&
    data.sources.every(
      (s) =>
        typeof s.doc_name === "string" &&
        Number.isInteger(s.page_no) &&
        s.page_no > 0 &&
        typeof s.content === "string",
    )
  );
}
/** A final SSE event replaces provisional text; EOF without final is an error. */
export async function askQuestion(
  question: string,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<AskResult> {
  const response = await fetch(`${API_BASE}/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!response.ok)
    throw new Error(
      `The API returned HTTP ${response.status}. Check that FastAPI and the database are running.`,
    );
  if (!response.body)
    throw new Error("Your browser could not read the answer stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    answer = "";
  let final: AskResult | null = null;
  const consume = (block: string) => {
    let event = "message";
    const lines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) lines.push(line.slice(5).trimStart());
    }
    if (!lines.length) return;
    const data = JSON.parse(lines.join("\n"));
    if (event === "error")
      throw new Error(
        "Answer generation failed. The draft has been discarded. Please try again.",
      );
    if (event === "delta" && typeof data.text === "string") {
      answer += data.text;
      onDelta(answer);
    }
    if (event === "final") {
      if (!isResult(data))
        throw new Error(
          "The API returned an incomplete answer. Please try again.",
        );
      final = data;
    }
  };
  try {
    while (!final) {
      const { done, value } = await reader.read();
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(
        /\r\n/g,
        "\n",
      );
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
      if (done) {
        if (buffer.trim()) consume(buffer);
        break;
      }
    }
    if (!final)
      throw new Error(
        "The connection ended before a final answer arrived. The draft has been discarded.",
      );
    return final;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
