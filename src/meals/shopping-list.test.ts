import { describe, expect, it } from "vitest";
import { mergeShoppingList, normalizeIngredientName } from "./shopping-list";

describe("normalizeIngredientName", () => {
  it("lowercases and strips simple trailing s", () => {
    expect(normalizeIngredientName("Garlic Cloves")).toBe("garlic clove");
    expect(normalizeIngredientName("  Olive Oil  ")).toBe("olive oil");
  });
});

describe("mergeShoppingList", () => {
  it("skips takeout and leftover meals", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "chicken", quantity: "1", unit: "lb", aisle: "meat" },
        ],
      },
      {
        leftover: true,
        ingredients: [
          { name: "chicken", quantity: "1", unit: "lb", aisle: "meat" },
        ],
      },
      {
        takeout: true,
        ingredients: [
          { name: "pad thai", quantity: "1", unit: "order", aisle: "other" },
        ],
      },
    ]);
    expect(list).toEqual([
      {
        aisle: "meat",
        items: [{ name: "chicken", quantity: "1", unit: "lb", aisle: "meat" }],
      },
    ]);
  });

  it("merges the same name+unit and groups by aisle", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "Garlic", quantity: "2", unit: "clove", aisle: "produce" },
          { name: "Salmon", quantity: "1", unit: "lb", aisle: "meat" },
        ],
      },
      {
        ingredients: [
          { name: "garlic", quantity: "1", unit: "clove", aisle: "produce" },
          { name: "Olive oil", quantity: "2", unit: "tbsp", aisle: "pantry" },
        ],
      },
    ]);
    const produce = list.find((g) => g.aisle === "produce")?.items;
    expect(produce).toEqual([
      { name: "garlic", quantity: "3", unit: "clove", aisle: "produce" },
    ]);
    expect(list.map((g) => g.aisle)).toEqual(["produce", "meat", "pantry"]);
  });

  it("adds fractions when name and unit match", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "olive oil", quantity: "1/2", unit: "cup", aisle: "pantry" },
        ],
      },
      {
        ingredients: [
          { name: "olive oil", quantity: "1/4", unit: "cup", aisle: "pantry" },
        ],
      },
    ]);
    expect(list[0].items).toEqual([
      { name: "olive oil", quantity: "3/4", unit: "cup", aisle: "pantry" },
    ]);
  });

  it("still merges leftover numeric quantities from older saved meals", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "garlic", quantity: 2 as unknown as string, unit: "clove", aisle: "produce" },
          { name: "garlic", quantity: "1", unit: "clove", aisle: "produce" },
        ],
      },
    ]);
    expect(list[0].items[0].quantity).toBe("3");
  });

  it("includes ingredients from a recipe extra and ignores a suggestion", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "salmon", quantity: "1", unit: "lb", aisle: "meat" },
        ],
        extras: {
          side: {
            id: "side-1",
            kind: "side",
            mode: "recipe",
            title: "Baked potato",
            whyItFits: "",
            cookMinutes: 45,
            method: "oven",
            ingredients: [
              { name: "russet potato", quantity: "2", unit: "count", aisle: "produce" },
            ],
            steps: ["Bake"],
            usedWebSearch: false,
            sourceUrl: null,
          },
          dessert: {
            id: "dessert-1",
            kind: "dessert",
            mode: "suggestion",
            title: "Key lime pie",
            whyItFits: "",
            cookMinutes: 0,
            method: "",
            ingredients: [
              { name: "lime", quantity: "4", unit: "count", aisle: "produce" },
            ],
            steps: [],
            usedWebSearch: false,
            sourceUrl: null,
          },
        },
      },
    ]);
    const produce = list.find((g) => g.aisle === "produce")?.items;
    expect(produce).toEqual([
      { name: "russet potato", quantity: "2", unit: "count", aisle: "produce" },
    ]);
    expect(list.map((g) => g.aisle)).toEqual(["produce", "meat"]);
  });

  it("does not merge the same name with different units", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "olive oil", quantity: "2", unit: "tbsp", aisle: "pantry" },
          { name: "olive oil", quantity: "1", unit: "cup", aisle: "pantry" },
        ],
      },
    ]);
    expect(list[0].items).toHaveLength(2);
  });
});
