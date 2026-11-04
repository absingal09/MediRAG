import { describe, expect, it } from "vitest";
import { matchSourceItems } from "./pdfSourceMatch";

describe("PDF passage location", () => {
  it("maps a unique passage across split PDF text items", () => {
    const items = [
      "Other text",
      "• ",
      "B",
      "ALANCE : Loss of balance or",
      "coordination",
      "Other text",
    ].map((str) => ({ str }));
    expect(
      matchSourceItems(items, "BALANCE: Loss of balance or coordination"),
    ).toEqual([2, 3, 4]);
  });
  it("does not substitute a similar passage or a heading for missing evidence", () => {
    expect(
      matchSourceItems(
        [{ str: "WARNING SIGNS (BEFAST)" }],
        "BALANCE: Loss of balance or coordination",
      ),
    ).toEqual([]);
  });
  it("rejects ambiguous duplicate passages", () => {
    const str = "BALANCE: Loss of balance or coordination";
    expect(matchSourceItems([{ str }, { str }], str)).toEqual([]);
  });
  it("preserves numeric thresholds and decimal points when locating evidence", () => {
    const items = [{ str: "Supplement potassium if serum K+ > 3.3 mEq/L" }];
    expect(
      matchSourceItems(items, "Supplement potassium if serum K+ < 3.3 mEq/L"),
    ).toEqual([]);
    expect(
      matchSourceItems(items, "Supplement potassium if serum K+ > 33 mEq/L"),
    ).toEqual([]);
  });
  it("rejects short fragments that cannot identify a source passage reliably", () => {
    expect(
      matchSourceItems([{ str: "Aortic dissection" }], "Aortic dissection"),
    ).toEqual([]);
  });
  it("keeps Unicode comparisons, multiplication and dose ranges distinct", () => {
    const source = "Supplement potassium if serum K+ ≤ 3.3 mEq/L";
    expect(
      matchSourceItems([{ str: source }], source.replace("≤", "≥")),
    ).toEqual([]);
    expect(
      matchSourceItems([{ str: source }], source.replace("≤", "")),
    ).toEqual([]);
    expect(
      matchSourceItems([{ str: source }], source.replace("≤", "<=")),
    ).toEqual([0]);
    const range = "Administer infusion over 10–20 minutes with monitoring";
    expect(
      matchSourceItems([{ str: range }], range.replace("10–20", "1020")),
    ).toEqual([]);
    const product = "Total dose of medication is 10 × 20 mg per day";
    expect(
      matchSourceItems([{ str: product }], product.replace("×", "")),
    ).toEqual([]);
  });
});
