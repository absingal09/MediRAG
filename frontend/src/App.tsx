import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Expand,
  FileText,
  Library,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  Square,
  Upload,
  X,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { catalog, documentById, documentUrl, readableName } from "./catalog";
import { askQuestion } from "./api";
import { PdfPage } from "./PdfReader";
import type { AskResult, Guideline, OpenDocument } from "./types";
import "./App.css";
import { SourceConnector } from "./SourceConnector";

const initialDocument = documentById("STW_DKA")!;
const prompts = [
  "What does the DKA guideline say about insulin?",
  "What are the warning signs of stroke?",
  "How is asthma assessed?",
];
type Phase = "idle" | "loading" | "streaming" | "done" | "error";

export default function App() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState("");
  const [example, setExample] = useState(false);
  const [document, setDocument] = useState<OpenDocument>({
    ...initialDocument,
    url: documentUrl(initialDocument),
  });
  const [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [zoom, setZoom] = useState(1);
  const [sourceIndex, setSourceIndex] = useState<number | null>(null);
  const [sourceTab, setSourceTab] = useState<"document" | "passages">(
    "document",
  );
  const [filter, setFilter] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const [localDocument, setLocalDocument] = useState<OpenDocument | null>(null);
  const [mobileSource, setMobileSource] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia?.("(max-width: 800px)").matches ?? false,
  );
  const [expanded, setExpanded] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const answerHeading = useRef<HTMLHeadingElement>(null);
  const libraryDialog = useRef<HTMLDialogElement>(null);
  const pdfDialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const localUrl = useRef<string | null>(null);
  const sourcePanel = useRef<HTMLElement>(null);
  const closeSourceButton = useRef<HTMLButtonElement>(null);
  const sourceTrigger = useRef<HTMLButtonElement>(null);
  const busy = phase === "loading" || phase === "streaming";
  const activeSource =
    sourceIndex !== null ? result?.sources[sourceIndex] : undefined;
  const sourceUnavailable = Boolean(
    activeSource && !documentById(activeSource.doc_name),
  );
  const finalAnswer = result && !result.refused && !result.invalid?.length;
  const closeSource = useCallback(() => {
    setMobileSource(false);
    window.setTimeout(() => sourceTrigger.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 800px)");
    if (!media) return;
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!isMobile || !mobileSource) return;
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    closeSourceButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (libraryDialog.current?.open || pdfDialog.current?.open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeSource();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        sourcePanel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex="0"]',
        ) ?? [],
      ).filter(
        (element) => element.getClientRects().length && element.tabIndex >= 0,
      );
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.document.addEventListener("keydown", onKey);
    return () => {
      window.document.body.style.overflow = previousOverflow;
      window.document.removeEventListener("keydown", onKey);
    };
  }, [isMobile, mobileSource, closeSource]);

  useEffect(
    () => () => {
      abort.current?.abort();
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    },
    [],
  );
  useEffect(() => {
    const focusQuestion = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !libraryDialog.current?.open &&
        !pdfDialog.current?.open &&
        !(isMobile && mobileSource)
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", focusQuestion);
    return () => window.removeEventListener("keydown", focusQuestion);
  }, [isMobile, mobileSource]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const updatePages = useCallback((count: number) => {
    setPages(count);
  }, []);

  function openDocument(item: Guideline | OpenDocument, targetPage = 1) {
    setDocument("url" in item ? item : { ...item, url: documentUrl(item) });
    setPage(targetPage);
    setPages(item.pages);
    setZoom(1);
    setSourceIndex(null);
    setSourceTab("document");
  }
  function selectSource(index: number, response = result, showMobile = true) {
    const source = response?.sources[index];
    if (!source) return;
    const item = documentById(source.doc_name);
    if (item) openDocument(item, source.page_no);
    else {
      setNotice(
        "This document is not in the local PDF library. Its retrieved passage is still available.",
      );
      setSourceTab("passages");
    }
    setSourceIndex(index);
    if (showMobile) setMobileSource(true);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (value.length < 3 || busy) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setAsked(value);
    setResult(null);
    setSourceIndex(null);
    setDraft("");
    setError("");
    setExample(false);
    setPhase("loading");
    try {
      const response = await askQuestion(
        value,
        (text) => {
          setDraft(text);
          setPhase("streaming");
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setResult(response);
      setDraft("");
      setPhase("done");
      if (!response.refused && !response.invalid?.length) {
        const first = response.sources.findIndex((source) =>
          response.citations.some(
            (cite) =>
              cite.doc_name === source.doc_name &&
              cite.page_no === source.page_no,
          ),
        );
        if (first !== -1) selectSource(first, response, false);
      }
      answerHeading.current?.focus();
    } catch (reason) {
      setDraft("");
      setResult(null);
      setSourceIndex(null);
      if (controller.signal.aborted) {
        setPhase("idle");
        setNotice("Request stopped. The draft was discarded.");
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not connect to the API. Please try again.",
        );
        setPhase("error");
      }
    }
  }
  function showExample() {
    const response: AskResult = {
      answer:
        "**BEFAST** stands for six warning-sign prompts in the stroke guideline: [S1]\n\n- **B — Balance:** loss of balance or coordination.\n- **E — Eyes:** sudden blurred or double vision, or persistent vision trouble.\n- **F — Face:** deviation at the angle of the mouth.\n- **A — Arm:** arm drift.\n- **S — Speech:** slurred speech or inability to speak or understand.\n- **T — Time:** act fast.",
      refused: false,
      invalid: [],
      citations: [{ doc_name: "STW_Stroke", page_no: 1 }],
      sources: [
        {
          doc_name: "STW_Stroke",
          page_no: 1,
          heading: "WARNING SIGNS (BEFAST)",
          content:
            "BALANCE: Loss of balance or coordination\nEYES: Sudden blurred or double vision / sudden, persistent vision trouble\nFACE: Deviation at the angle of the mouth\nARM: Arm Drift\nSPEECH: Slurred speech or the inability to speak or understand\nTIME: Act fast",
        },
      ],
    };
    setAsked("What does BEFAST stand for in the stroke guideline?");
    setQuestion("What does BEFAST stand for in the stroke guideline?");
    setResult(response);
    setExample(true);
    setPhase("done");
    setError("");
    setDraft("");
    selectSource(0, response, false);
  }
  async function importPdf(file?: File) {
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size > 25 * 1024 * 1024
    ) {
      setNotice("Choose a PDF smaller than 25 MB.");
      return;
    }
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    const url = URL.createObjectURL(file);
    localUrl.current = url;
    const item: OpenDocument = {
      id: "local-preview",
      title: file.name,
      shortTitle: file.name,
      file: file.name,
      pages: 1,
      edition: "Local preview",
      sourceUrl: "",
      size: file.size,
      url,
      local: true,
    };
    setLocalDocument(item);
    openDocument(item);
    libraryDialog.current?.close();
    setMobileSource(true);
    setNotice(
      "PDF opened locally. It has not been uploaded or added to search.",
    );
  }
  async function copyAnswer() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(
        `${result.answer}\n\n${result.citations.map((cite) => `${readableName(cite.doc_name)}, page ${cite.page_no}`).join("\n")}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice(
        "Clipboard access was unavailable. You can select and copy the answer text.",
      );
    }
  }
  function expandPdf() {
    pdfDialog.current?.showModal();
    setExpanded(true);
  }
  const sourceText = activeSource?.content;
  const matches = catalog.filter((item) =>
    `${item.title} ${item.shortTitle}`
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const answerMarkdown =
    result?.answer.replace(/\[S(\d+)\]/g, (_, tag: string) => {
      const index = Number(tag) - 1,
        source = result.sources[index];
      if (
        !finalAnswer ||
        !source ||
        !result.citations.some(
          (cite) =>
            cite.doc_name === source.doc_name &&
            cite.page_no === source.page_no,
        )
      )
        return "";
      return `[${readableName(source.doc_name)} · p. ${source.page_no}](#source-${index})`;
    }) ?? "";

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to question
      </a>
      <header className="site-header" inert={isMobile && mobileSource}>
        <a className="brand" href="./" aria-label="MediRAG home">
          <BookOpen size={25} strokeWidth={1.6} />
          <span>
            Medi<span className="brand-end">RAG</span>
            <i>.</i>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className="nav-item current"
            aria-current="page"
            onClick={() => {
              libraryDialog.current?.close();
              input.current?.focus();
            }}
          >
            Ask
          </button>
          <button
            className="nav-item"
            onClick={() => libraryDialog.current?.showModal()}
          >
            Library <span className="count">{catalog.length}</span>
          </button>
        </nav>
        <span className="header-note">
          A little less searching.
          <br />
          <strong>A little more understanding.</strong>
        </span>
      </header>

      <main
        id="main"
        className={`workspace ${phase !== "idle" ? "has-response" : ""}`}
      >
        {finalAnswer && activeSource && !sourceUnavailable && (
          <SourceConnector />
        )}
        <section
          className="reading-column"
          aria-label="Question and answer"
          inert={isMobile && mobileSource}
        >
          <div className="desk-label">
            <span className="blue-rule" />
            THE GUIDELINE DESK{" "}
            <span className="edition">ICMR · {catalog.length} workflows</span>
          </div>
          <h1>
            {phase === "idle" && !result ? (
              <>
                Go from a question
                <br />
                to <em>the source.</em>
              </>
            ) : (
              <>
                A closer look
                <br />
                at the guidelines.
              </>
            )}
          </h1>
          <p className="lead">
            Ask the ICMR treatment guidelines. Read the answer,
            <br className="desktop-break" /> then follow the evidence back to
            the page.
          </p>

          <form
            className={`question-form ${busy ? "is-busy" : ""}`}
            onSubmit={submit}
          >
            <label htmlFor="question">YOUR QUESTION</label>
            <textarea
              id="question"
              ref={input}
              placeholder="What would you like to understand?"
              value={question}
              maxLength={500}
              minLength={3}
              required
              rows={2}
              disabled={busy}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                  e.currentTarget.form?.requestSubmit();
              }}
            />
            <div className="form-bottom">
              <span className="form-hint">
                {busy
                  ? "Retrieving passages & preparing an answer"
                  : "From the documents. With the sources."}
              </span>
              {busy ? (
                <button
                  type="button"
                  className="ask-button stop-button"
                  onClick={() => abort.current?.abort()}
                >
                  <Square size={12} fill="currentColor" /> Stop
                </button>
              ) : (
                <button
                  className="ask-button"
                  type="submit"
                  disabled={question.trim().length < 3}
                >
                  Ask the guidelines <ArrowRight size={17} />
                </button>
              )}
            </div>
          </form>

          {phase === "idle" && !result && (
            <div className="welcome-content">
              <div className="suggested">
                <span className="small-label">A FEW PLACES TO START</span>
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setQuestion(prompt);
                      input.current?.focus();
                    }}
                  >
                    {prompt}
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
              <div className="how-note">
                <span className="note-number">01 / 03</span>
                <h2>Every answer has a way back.</h2>
                <p>
                  Document and page references sit alongside the answer. Open
                  one to read the original workflow and inspect the retrieved
                  passage.
                </p>
                <button className="text-button" onClick={showExample}>
                  Explore an interface example <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {busy && (
            <section
              className="answer-section"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="answer-meta">
                <LoaderCircle className="spin" size={15} />
                <span>
                  {phase === "loading"
                    ? "FINDING RELEVANT PASSAGES"
                    : "PROVISIONAL DRAFT · CHECKING CITATIONS"}
                </span>
              </div>
              {draft ? (
                <p className="draft-text">
                  {draft
                    .replace(/\[S\d+\]/g, "")
                    .replace(
                      "NOT_IN_DOCUMENTS",
                      "Checking whether the sources answer your question…",
                    )}
                </p>
              ) : (
                <div className="skeleton" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              )}
              <p className="quiet-note">
                The final answer will replace this draft.
              </p>
            </section>
          )}
          {phase === "error" && (
            <section className="answer-section error-box" role="alert">
              <span className="small-label">COULDN’T COMPLETE THE ANSWER</span>
              <h2>Let’s try that again.</h2>
              <p>{error}</p>
              <p className="quiet-note">
                Your question is kept above. Submit it again when ready.
              </p>
            </section>
          )}

          {phase === "done" && result && (
            <article className="answer-section">
              <div className="answer-meta">
                <span className="answer-dot" />
                <span>
                  {example
                    ? "INTERFACE EXAMPLE · NOT AN API ANSWER"
                    : result.refused || result.invalid?.length
                      ? "NOT ANSWERED FROM THE SOURCES"
                      : "DOCUMENT-BASED RESPONSE"}
                </span>
                <button
                  className="icon-button copy-button"
                  aria-label={copied ? "Answer copied" : "Copy answer"}
                  onClick={copyAnswer}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <h2
                className="answered-question"
                ref={answerHeading}
                tabIndex={-1}
              >
                {asked}
              </h2>
              <div className="answer-prose">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => {
                      const match = href?.match(/^#source-(\d+)$/);
                      if (!match) return <span>{children}</span>;
                      const index = Number(match[1]);
                      return (
                        <button
                          className={`citation ${sourceIndex === index ? "selected" : ""}`}
                          aria-pressed={sourceIndex === index}
                          onClick={() => selectSource(index)}
                        >
                          <span className="citation-mark">{index + 1}</span>
                          {children}
                          <ArrowUpRight size={12} />
                        </button>
                      );
                    },
                  }}
                >
                  {answerMarkdown}
                </Markdown>
              </div>
              {example && (
                <p className="example-note">
                  This saved example uses an excerpt from the Stroke guideline,
                  page 1. It is not a live model response.
                </p>
              )}
              {!!result.sources.length && (
                <details className="evidence-details">
                  <summary>
                    Inspect retrieved passages{" "}
                    <span>{result.sources.length}</span>
                    <ArrowDown size={15} />
                  </summary>
                  <div className="evidence-list">
                    {result.sources.map((source, index) => (
                      <button
                        className="evidence-item"
                        key={`${source.doc_name}-${index}`}
                        onClick={() => {
                          selectSource(index);
                          setSourceTab("passages");
                        }}
                      >
                        <span className="source-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <strong>
                            {readableName(source.doc_name)}{" "}
                            <span>· page {source.page_no}</span>
                          </strong>
                          <p>{source.content}</p>
                        </div>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                </details>
              )}
              <p className="answer-footnote">
                {result.refused
                  ? "A refusal can reflect missing retrieval evidence, not necessarily missing guidance."
                  : "Citations locate a source. They do not guarantee that every claim is supported."}
              </p>
            </article>
          )}
          <footer className="reading-footer">
            <span>Built for reading, backed by sources.</span>
            <span>Guideline lookup · not medical advice</span>
          </footer>
        </section>

        <aside
          ref={sourcePanel}
          role={isMobile && mobileSource ? "dialog" : undefined}
          aria-modal={isMobile && mobileSource ? true : undefined}
          className={`source-column ${mobileSource ? "mobile-open" : ""}`}
          aria-label="Source notes"
        >
          <div className="source-heading">
            <div>
              <span className="small-label">READ ALONG</span>
              <h2>
                Source notes<span>.</span>
              </h2>
            </div>
            <button
              className="icon-button mobile-close"
              ref={closeSourceButton}
              aria-label="Close source notes"
              onClick={closeSource}
            >
              <X size={20} />
            </button>
            <span className="source-decoration" aria-hidden="true">
              ↗
            </span>
          </div>
          <div className="source-document">
            <span className="document-glyph">
              <FileText size={21} strokeWidth={1.4} />
            </span>
            <div>
              <h3>
                {sourceUnavailable
                  ? readableName(activeSource!.doc_name)
                  : document.shortTitle}
              </h3>
              <p>
                {sourceUnavailable
                  ? "PDF not available in this library"
                  : document.local
                    ? "Local PDF · not included in search"
                    : `${document.edition} · ICMR workflow`}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Choose a guideline"
              onClick={() => libraryDialog.current?.showModal()}
            >
              <Library size={18} />
            </button>
          </div>
          <div className="source-context">
            {activeSource
              ? `Selected source ${sourceIndex! + 1} · ${readableName(activeSource.doc_name)} · page ${activeSource.page_no}`
              : document.local
                ? "Local preview only"
                : "Browsing the original document"}
          </div>
          {activeSource && (
            <section
              className="selected-passage"
              aria-label="Selected source passage"
            >
              <span className="small-label">
                {example
                  ? "SELECTED EXAMPLE · PDF EXCERPT"
                  : "SELECTED RETRIEVED PASSAGE"}
              </span>
              <p>{sourceText}</p>
              <span>
                {readableName(activeSource.doc_name)} · page{" "}
                {activeSource.page_no}
              </span>
            </section>
          )}
          <div className="source-tabs" role="tablist" aria-label="Source view">
            <button
              role="tab"
              id="document-tab"
              aria-controls="document-panel"
              aria-selected={sourceTab === "document"}
              disabled={sourceUnavailable}
              tabIndex={sourceTab === "document" ? 0 : -1}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  setSourceTab("passages");
                  (
                    event.currentTarget.nextElementSibling as HTMLElement
                  )?.focus();
                }
              }}
              onClick={() => setSourceTab("document")}
            >
              Document
            </button>
            <button
              role="tab"
              id="passages-tab"
              aria-controls="passages-panel"
              aria-selected={sourceTab === "passages"}
              tabIndex={sourceTab === "passages" ? 0 : -1}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" && !sourceUnavailable) {
                  setSourceTab("document");
                  (
                    event.currentTarget.previousElementSibling as HTMLElement
                  )?.focus();
                }
              }}
              onClick={() => setSourceTab("passages")}
            >
              Passage {activeSource && <span className="tiny-dot" />}
            </button>
            <button
              className="icon-button expand-button"
              aria-label="Expand document reader"
              disabled={sourceUnavailable}
              onClick={expandPdf}
            >
              <Expand size={15} />
            </button>
          </div>
          <div
            role="tabpanel"
            id="document-panel"
            aria-labelledby="document-tab"
            hidden={sourceTab !== "document"}
          >
            <div className="pdf-toolbar">
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page <strong>{page}</strong> of {pages}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div>
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  disabled={zoom <= 0.75}
                  onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}
                >
                  <Minus size={14} />
                </button>
                <button
                  className="fit-button"
                  onClick={() => setZoom(1)}
                  aria-label="Fit page width"
                >
                  {zoom === 1 ? "Fit" : `${Math.round(zoom * 100)}%`}
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  disabled={zoom >= 3}
                  onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
            {!expanded && !sourceUnavailable && (
              <PdfPage
                url={document.url}
                page={page}
                zoom={zoom}
                onPages={updatePages}
              />
            )}
            {!sourceUnavailable && (
              <a
                className="original-link"
                href={`${document.url}#page=${page}`}
                target="_blank"
                rel="noreferrer"
              >
                Open original PDF <ArrowUpRight size={14} />
              </a>
            )}
          </div>
          <div
            role="tabpanel"
            id="passages-panel"
            aria-labelledby="passages-tab"
            hidden={sourceTab !== "passages"}
            className="passage-panel"
          >
            <span className="small-label">
              {example
                ? "EXAMPLE · EXCERPT FROM THE PDF"
                : "TEXT RETURNED BY RETRIEVAL"}
            </span>
            {sourceText ? (
              <>
                <h3>
                  {activeSource?.heading ||
                    readableName(activeSource!.doc_name)}
                </h3>
                <p>{sourceText}</p>
                <span className="passage-attribution">
                  {readableName(activeSource!.doc_name)} · page{" "}
                  {activeSource!.page_no}
                </span>
              </>
            ) : (
              <>
                <h3>The passage comes next.</h3>
                <p>
                  Ask a question and select a citation to inspect the exact text
                  returned by retrieval.
                </p>
              </>
            )}
          </div>
          <p className="source-caption">
            {document.local ? (
              "This PDF stays in your browser. It is not sent to the model."
            ) : (
              <>
                Original page, original layout.
                <br />
                Expand the reader for the full workflow.
              </>
            )}
          </p>
        </aside>
      </main>
      <button
        className="mobile-source-button"
        ref={sourceTrigger}
        disabled={isMobile && mobileSource}
        aria-hidden={isMobile && mobileSource}
        onClick={() => setMobileSource(true)}
      >
        <BookOpen size={17} />
        Source notes <ArrowUpRight size={15} />
      </button>
      <div className="toast" role="status" aria-live="polite">
        {notice}
      </div>

      <dialog
        className="library-dialog"
        ref={libraryDialog}
        aria-labelledby="library-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="dialog-header">
          <div>
            <span className="small-label">THE COLLECTION</span>
            <h2 id="library-title">
              Fourteen workflows.
              <br />
              <em>One reading desk.</em>
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close library"
            onClick={() => libraryDialog.current?.close()}
          >
            <X size={21} />
          </button>
        </div>
        <div className="library-tools">
          <label className="library-search">
            <Search size={17} />
            <input
              autoFocus
              placeholder="Find a guideline…"
              aria-label="Search guidelines"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            Open local PDF
          </button>
          <input
            type="file"
            accept="application/pdf,.pdf"
            ref={fileInput}
            hidden
            onChange={(e) => {
              void importPdf(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <p className="library-note">
          {catalog.length} ICMR workflows in the corpus. Local PDFs can be
          previewed; adding them to retrieval needs an ingestion endpoint.
        </p>
        <div className="library-grid">
          {matches.map((item, index) => (
            <button
              key={item.id}
              className={`library-card ${item.id === document.id ? "active" : ""}`}
              onClick={() => {
                openDocument(item);
                libraryDialog.current?.close();
                setMobileSource(true);
              }}
            >
              <span className="library-card-top">
                <FileText size={21} strokeWidth={1.3} />
                <span>{String(index + 1).padStart(2, "0")}</span>
              </span>
              <strong>{item.title}</strong>
              <span className="library-card-meta">
                {item.edition}
                <span>
                  {item.pages} {item.pages === 1 ? "page" : "pages"}{" "}
                  <ArrowUpRight size={13} />
                </span>
              </span>
            </button>
          ))}
          {!matches.length && (
            <div className="no-results">
              <h3>No matching guidelines.</h3>
              <p>Try a condition name or abbreviation.</p>
              <button className="text-button" onClick={() => setFilter("")}>
                Clear search
              </button>
            </div>
          )}
        </div>
        {localDocument && (
          <button
            className="local-file-row"
            onClick={() => {
              openDocument(localDocument);
              libraryDialog.current?.close();
              setMobileSource(true);
            }}
          >
            <FileText size={19} />
            <span>
              {localDocument.title}
              <small>Local preview · not in search</small>
            </span>
            <ArrowUpRight size={15} />
          </button>
        )}
      </dialog>
      <dialog
        className="expanded-dialog"
        ref={pdfDialog}
        aria-labelledby="expanded-title"
        onClose={() => setExpanded(false)}
      >
        <div className="expanded-header">
          <div>
            <span className="small-label">ORIGINAL DOCUMENT</span>
            <h2 id="expanded-title">
              {document.shortTitle} <span>· page {page}</span>
            </h2>
          </div>
          <div>
            <a
              className="secondary-button"
              href={`${document.url}#page=${page}`}
              target="_blank"
              rel="noreferrer"
            >
              Open original <ArrowUpRight size={15} />
            </a>
            <button
              className="icon-button"
              aria-label="Close expanded reader"
              onClick={() => pdfDialog.current?.close()}
            >
              <X size={22} />
            </button>
          </div>
        </div>
        {expanded && (
          <PdfPage
            url={document.url}
            page={page}
            zoom={1}
            onPages={updatePages}
          />
        )}
      </dialog>
    </>
  );
}
