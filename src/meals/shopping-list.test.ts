import { describe, expect, it } from "vitest";
import { mergeShoppingList, normalizeIngredientName } from "./shopping-list";

describe("normalizeIngredientName", () => {
  it("lowercases and strips simple trailing s", () => {
    expect(normalizeIngredientName("Garlic Cloves")).toBe("garlic clove");
    expect(normalizeIngredientName("  Olive Oil  ")).toBe("olive oil");
  });
});

describe("mergeShoppingList", () => {
  it("merges the same name+unit and groups by aisle", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "Garlic", quantity: 2, unit: "clove", aisle: "produce" },
          { name: "Salmon", quantity: 1, unit: "lb", aisle: "meat" },
        ],
      },
      {
        ingredients: [
          { name: "garlic", quantity: 1, unit: "clove", aisle: "produce" },
          { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "pantry" },
        ],
      },
    ]);
    const produce = list.find((g) => g.aisle === "produce")?.items;
    expect(produce).toEqual([
      { name: "garlic", quantity: 3, unit: "clove", aisle: "produce" },
    ]);
    expect(list.map((g) => g.aisle)).toEqual(["produce", "meat", "pantry"]);
  });

  it("does not merge the same name with different units", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "olive oil", quantity: 2, unit: "tbsp", aisle: "pantry" },
          { name: "olive oil", quantity: 1, unit: "cup", aisle: "pantry" },
        ],
      },
    ]);
    expect(list[0].items).toHaveLength(2);
  });
});
