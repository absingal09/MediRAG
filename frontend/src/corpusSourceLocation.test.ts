import { expect, it } from "vitest";
import { corpusSourceLocation } from "./corpusSourceLocation";
import data from "./generated/sourceLocations.json";

it("locates every ingested chunk including short fragments and reordered flowcharts", async () => {
  expect(data.locations).toHaveLength(494);
  for (const location of data.locations) {
    const rects = await corpusSourceLocation(
      location.doc,
      location.page,
      location.heading,
      location.content,
    );
    expect(
      rects.length,
      `${location.doc} page ${location.page}`,
    ).toBeGreaterThan(0);
    for (const [x0, y0, x1, y1] of rects) {
      expect([x0, y0, x1, y1].every(Number.isFinite)).toBe(true);
      expect(x1).toBeGreaterThan(x0);
      expect(y1).toBeGreaterThan(y0);
    }
  }
});
it("never substitutes another document, page, heading, or altered dose", async () => {
  const location = data.locations.find((item) => item.content.includes("3.3"))!;
  expect(location).toBeDefined();
  for (const [doc, page, heading, content] of [
    ["STW_Unknown", location.page, location.heading, location.content],
    [location.doc, 999, location.heading, location.content],
    [location.doc, location.page, "Wrong heading", location.content],
    [
      location.doc,
      location.page,
      location.heading,
      location.content.replace("3.3", "33"),
    ],
  ] as [string, number, string, string][]) {
    expect(await corpusSourceLocation(doc, page, heading, content)).toEqual([]);
  }
});
