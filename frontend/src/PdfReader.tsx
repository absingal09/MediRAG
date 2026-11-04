import { lazy, Suspense } from "react";
import type { ComponentProps } from "react";
import type { PdfPage as PageComponent } from "./PdfPage";
const Page = lazy(() =>
  import("./PdfPage").then((module) => ({ default: module.PdfPage })),
);
export function PdfPage(props: ComponentProps<typeof PageComponent>) {
  return (
    <Suspense
      fallback={<div className="pdf-state">Loading the document reader…</div>}
    >
      <Page key={props.url} {...props} />
    </Suspense>
  );
}
