export interface Guideline {
  id: string;
  title: string;
  shortTitle: string;
  file: string;
  pages: number;
  edition: string;
  sourceUrl: string;
  size: number;
}
export interface Source {
  doc_name: string;
  page_no: number;
  heading: string;
  content: string;
  score?: number;
}
export interface AskResult {
  answer: string;
  refused: boolean;
  citations: { doc_name: string; page_no: number }[];
  sources: Source[];
  invalid?: number[];
}
export interface OpenDocument extends Guideline {
  url: string;
  local?: boolean;
}
