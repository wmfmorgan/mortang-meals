import { describe, expect, it } from "vitest";
import { findAllergen, findDietExclude } from "./allergen";

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

describe("findDietExclude", () => {
  it("treats dairy butter as an exclude but not peanut butter", () => {
    expect(
      findDietExclude(
        [{ name: "smooth peanut butter", quantity: "1/2", unit: "cup", aisle: "pantry" }],
        ["butter"],
      ),
    ).toBeNull();
    expect(
      findDietExclude(
        [{ name: "unsalted butter", quantity: "2", unit: "tbsp", aisle: "dairy" }],
        ["butter"],
      ),
    ).toBe("butter");
  });

  it("allows plant milks and coconut cream when excluding milk or cream", () => {
    expect(
      findDietExclude(
        [{ name: "unsweetened soy milk", quantity: "1", unit: "cup", aisle: "pantry" }],
        ["milk"],
      ),
    ).toBeNull();
    expect(
      findDietExclude(
        [{ name: "coconut cream", quantity: "1/4", unit: "cup", aisle: "pantry" }],
        ["cream"],
      ),
    ).toBeNull();
  });
});
