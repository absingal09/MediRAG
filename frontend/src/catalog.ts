import guidelines from "virtual:guidelines";
import type { Guideline } from "./types";
export const catalog: Guideline[] = guidelines;
export const documentById = (id: string) =>
  catalog.find((item) => item.id === id);
export const documentUrl = (item: Guideline) =>
  `${import.meta.env.BASE_URL}documents/${encodeURIComponent(item.file)}`;
export const readableName = (id: string) =>
  documentById(id)?.shortTitle ?? id.replace(/^STW_/, "").replaceAll("_", " ");
