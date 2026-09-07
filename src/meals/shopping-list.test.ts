import { describe, expect, it } from "vitest";
import {
  canonicalUnit,
  mergeShoppingList,
  normalizeIngredientName,
} from "./shopping-list";

describe("normalizeIngredientName", () => {
  it("lowercases and strips simple trailing s", () => {
    expect(normalizeIngredientName("Garlic Cloves")).toBe("garlic clove");
    expect(normalizeIngredientName("  Olive Oil  ")).toBe("olive oil");
  });

  it("strips prep words and parentheticals", () => {
    expect(normalizeIngredientName("freshly squeezed lemon juice")).toBe(
      "lemon juice",
    );
    expect(normalizeIngredientName("ripe avocado, roughly chopped")).toBe(
      "avocado",
    );
    expect(
      normalizeIngredientName("tuna (preferably packed in olive oil, drained)"),
    ).toBe("tuna");
  });

  it("does not collapse garlic powder into garlic", () => {
    expect(normalizeIngredientName("garlic powder")).toBe("garlic powder");
    expect(normalizeIngredientName("garlic")).toBe("garlic");
  });

  it("keeps herb lists instead of cutting at the first comma", () => {
    expect(
      normalizeIngredientName(
        "fresh chopped herbs such as parsley, thyme, basil, and/or chive",
      ),
    ).toContain("parsley");
    expect(
      normalizeIngredientName(
        "fresh chopped herbs such as parsley, thyme, basil, and/or chive",
      ),
    ).toContain("thyme");
    expect(normalizeIngredientName("fresh chopped parsley")).toBe("parsley");
  });
});

describe("canonicalUnit", () => {
  it("aliases tablespoon spellings and clove sizes", () => {
    expect(canonicalUnit("tablespoon")).toBe("tbsp");
    expect(canonicalUnit("Tablespoons")).toBe("tbsp");
    expect(canonicalUnit("small clove")).toBe("clove");
    expect(canonicalUnit("cloves")).toBe("clove");
    expect(canonicalUnit("teaspoon")).toBe("tsp");
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

  it("does not merge inconvertible units of the same name", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "red onion", quantity: "1/4", unit: "cup", aisle: "produce" },
          { name: "red onion", quantity: "1/2", unit: "medium", aisle: "produce" },
        ],
      },
    ]);
    expect(list[0].items).toHaveLength(2);
  });

  it("merges lemon juice across tsp and tbsp", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "lemon juice", quantity: "2", unit: "tsp", aisle: "produce" },
          { name: "freshly squeezed lemon juice", quantity: "3", unit: "tbsp", aisle: "produce" },
        ],
      },
    ]);
    expect(list[0].items).toEqual([
      { name: "lemon juice", quantity: "3 2/3", unit: "tbsp", aisle: "produce" },
    ]);
  });

  it("merges parsley wordings into one line", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "fresh chopped parsley", quantity: "1", unit: "tbsp", aisle: "produce" },
          {
            name: "chopped fresh cilantro or parsley",
            quantity: "2",
            unit: "tablespoons",
            aisle: "produce",
          },
          {
            name: "fresh chopped herbs such as parsley, thyme, basil, and/or chive",
            quantity: "1",
            unit: "tbsp",
            aisle: "produce",
          },
        ],
      },
    ]);
    expect(list[0].items).toEqual([
      { name: "parsley", quantity: "4", unit: "tbsp", aisle: "produce" },
    ]);
  });

  it("does not merge lemon juice with lemon zest", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "lemon juice", quantity: "2", unit: "tsp", aisle: "produce" },
          { name: "lemon zest", quantity: "1", unit: "tsp", aisle: "produce" },
        ],
      },
    ]);
    expect(list[0].items).toHaveLength(2);
  });

  it("merges extra virgin olive oil with olive oil", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "extra virgin olive oil", quantity: "3", unit: "tbsp", aisle: "pantry" },
          { name: "olive oil", quantity: "1 1/2", unit: "tbsp", aisle: "pantry" },
        ],
      },
    ]);
    expect(list[0].items).toEqual([
      { name: "olive oil", quantity: "4 1/2", unit: "tbsp", aisle: "pantry" },
    ]);
  });

  it("merges garlic clove aliases into one line", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "garlic", quantity: "1", unit: "clove", aisle: "produce" },
          { name: "garlic", quantity: "1", unit: "small clove", aisle: "produce" },
          { name: "garlic", quantity: "2", unit: "cloves", aisle: "produce" },
        ],
      },
    ]);
    expect(list[0].items).toEqual([
      { name: "garlic", quantity: "4", unit: "clove", aisle: "produce" },
    ]);
  });

  it("merges tablespoon aliases for olive oil", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          {
            name: "extra virgin olive oil",
            quantity: "1",
            unit: "tablespoon",
            aisle: "pantry",
          },
          {
            name: "extra virgin olive oil",
            quantity: "3",
            unit: "tbsp",
            aisle: "pantry",
          },
        ],
      },
    ]);
    expect(list[0].items).toEqual([
      {
        name: "extra virgin olive oil",
        quantity: "4",
        unit: "tbsp",
        aisle: "pantry",
      },
    ]);
  });

  it("does not merge garlic with garlic powder", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "garlic", quantity: "2", unit: "clove", aisle: "produce" },
          { name: "garlic powder", quantity: "1", unit: "tsp", aisle: "pantry" },
        ],
      },
    ]);
    expect(list.find((g) => g.aisle === "produce")?.items).toEqual([
      { name: "garlic", quantity: "2", unit: "clove", aisle: "produce" },
    ]);
    expect(list.find((g) => g.aisle === "pantry")?.items).toEqual([
      { name: "garlic powder", quantity: "1", unit: "tsp", aisle: "pantry" },
    ]);
  });
});
