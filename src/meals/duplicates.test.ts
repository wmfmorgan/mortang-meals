import { describe, expect, it } from "vitest";
import { isDuplicateTitle, normalizeTitle } from "./duplicates";

describe("normalizeTitle", () => {
  it("lowercases, strips punctuation, collapses space", () => {
    expect(normalizeTitle("  Lemon-Herb Salmon! ")).toBe("lemon herb salmon");
  });
});

describe("isDuplicateTitle", () => {
  it("matches the replaced meal and other plan titles", () => {
    const taken = ["Lemon herb salmon", "Crockpot chicken"];
    expect(isDuplicateTitle("lemon-herb salmon", taken)).toBe(true);
    expect(isDuplicateTitle("Sheet-pan salmon", taken)).toBe(false);
  });
});
