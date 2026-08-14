import { describe, expect, it } from "vitest";
import { findAllergen } from "./allergen";

const shrimp = {
  name: "shrimp",
  quantity: "1",
  unit: "lb",
  aisle: "meat" as const,
};
const rice = {
  name: "rice",
  quantity: "1",
  unit: "cup",
  aisle: "pantry" as const,
};

describe("findAllergen", () => {
  it("returns the first allergy that appears in an ingredient name", () => {
    expect(findAllergen([shrimp, rice], ["shellfish", "shrimp"])).toBe("shrimp");
  });

  it("returns null when nothing matches", () => {
    expect(findAllergen([rice], ["shrimp"])).toBeNull();
  });

  it("matches case-insensitively as a whole word or substring token", () => {
    expect(findAllergen([{ ...shrimp, name: "Garlic Shrimp" }], ["shrimp"])).toBe(
      "shrimp",
    );
  });
});
