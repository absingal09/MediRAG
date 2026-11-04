type Location = {
  doc: string;
  page: number;
  heading: string;
  content: string;
  rects: number[][];
};
const compact = (text: string) => text.normalize("NFKC").replace(/\s/gu, "");

/** Exact ingestion text + heading + document + page; never guess a nearby box. */
export async function corpusSourceLocation(
  doc: string,
  page: number,
  heading: string,
  content: string,
) {
  const { default: data } = await import("./generated/sourceLocations.json");
  const matches = (data.locations as Location[]).filter(
    (location) =>
      location.doc === doc &&
      location.page === page &&
      compact(location.heading) === compact(heading) &&
      compact(location.content) === compact(content),
  );
  return matches.flatMap((location) => location.rects);
}
