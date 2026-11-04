import { useEffect, useRef, useState } from "react";

/** A visual reading aid, not a claim of coordinates inside the PDF. */
export function SourceConnector() {
  const svg = useRef<SVGSVGElement>(null);
  const [path, setPath] = useState("");

  useEffect(() => {
    const workspace = svg.current?.parentElement;
    if (!workspace) return;
    const measure = () => {
      const citation = workspace.querySelector(".citation.selected");
      const reading = workspace.querySelector(".reading-column");
      const target = workspace.querySelector(".source-document");
      if (!citation || !reading || !target || window.innerWidth <= 800) {
        setPath("");
        return;
      }
      const origin = workspace.getBoundingClientRect();
      const from = citation.getBoundingClientRect();
      const column = reading.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const x0 = column.right - origin.left + 8;
      const x1 = to.left - origin.left - 8;
      const y0 = from.top + from.height / 2 - origin.top;
      const y1 = to.top + to.height / 2 - origin.top;
      const middle = (x0 + x1) / 2;
      setPath(
        x1 > x0 && from.height > 0
          ? `M ${x0} ${y0} C ${middle} ${y0}, ${middle} ${y1}, ${x1} ${y1}`
          : "",
      );
    };
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(workspace);
    for (const element of workspace.querySelectorAll(
      ".reading-column, .source-column",
    )) {
      observer?.observe(element);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    let active = true;
    void window.document.fonts?.ready.then(() => {
      if (active) measure();
    });
    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  });

  return (
    <svg
      ref={svg}
      className="source-connector"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker
          id="source-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 1 1 L 9 5 L 1 9" />
        </marker>
      </defs>
      {path && <path d={path} markerEnd="url(#source-arrow)" />}
    </svg>
  );
}
