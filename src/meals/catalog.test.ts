import { describe, expect, it } from "vitest";
import type { Meal } from "@/lib/types";
import { EMPTY_EXTRAS } from "./extras";
import {
  filterCatalogMeals,
  groupCatalogMeals,
  mealMatchesChip,
  sortCatalogMeals,
  uniqueCatalogMeals,
} from "./catalog";

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: "1",
    planId: "p",
    day: "monday",
    slot: "dinner",
    title: "Lemon herb salmon",
    whyItFits: "High-protein",
    cookMinutes: 30,
    method: "sheet pan",
    ingredients: [{ name: "salmon", quantity: "1", unit: "lb", aisle: "meat" }],
    steps: ["Roast"],
    usedWebSearch: false,
    pinned: false,
    createdAt: "2026-08-10T12:00:00.000Z",
    sourceUrl: null,
        imageUrl: null,
        extras: EMPTY_EXTRAS,
    draft: false,
    stars: 0,
    takeout: false,
    leftover: false,
  servings: 2,
    ...overrides,
  };
}

describe("filterCatalogMeals", () => {
  const meals = [
    meal(),
    meal({
      id: "2",
      slot: "breakfast",
      title: "Yogurt bowl",
      ingredients: [{ name: "yogurt", quantity: "1", unit: "cup", aisle: "dairy" }],
      createdAt: "2026-08-11T12:00:00.000Z",
    }),
  ];

  it("filters by search across title and ingredients", () => {
    expect(filterCatalogMeals(meals, { search: "salmon" })).toHaveLength(1);
    expect(filterCatalogMeals(meals, { search: "yogurt" })[0]?.title).toBe(
      "Yogurt bowl",
    );
  });

  it("filters by slot and date", () => {
    expect(filterCatalogMeals(meals, { slot: "dinner" })).toHaveLength(1);
    expect(filterCatalogMeals(meals, { date: "2026-08-11" })).toHaveLength(1);
  });
});

describe("groupCatalogMeals", () => {
  it("groups by slot and date", () => {
    const meals = [
      meal({ id: "a", slot: "dinner" }),
      meal({ id: "b", slot: "breakfast", createdAt: "2026-08-12T00:00:00.000Z" }),
    ];
    expect(
      groupCatalogMeals(
        [...meals, meal({ id: "c", slot: "dessert" })],
        "slot",
      ).map((g) => g.key),
    ).toEqual(["breakfast", "dinner", "dessert"]);
    expect(groupCatalogMeals(meals, "date").map((g) => g.key)).toEqual([
      "2026-08-12",
      "2026-08-10",
    ]);
  });

  it("group by none is one unlabeled group in given order", () => {
    const meals = [
      meal({ id: "a", slot: "dinner" }),
      meal({ id: "b", slot: "breakfast", createdAt: "2026-08-12T00:00:00.000Z" }),
    ];
    const groups = groupCatalogMeals(meals, "none");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("");
    expect(groups[0]?.meals.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("groups by normalized method", () => {
    const groups = groupCatalogMeals(
      [
        meal({ id: "a", method: "Sheet Pan" }),
        meal({ id: "b", method: "sheet pan" }),
        meal({ id: "c", method: "crockpot" }),
        meal({ id: "d", method: "" }),
      ],
      "method",
    );
    expect(groups.map((g) => g.key)).toEqual(["crockpot", "sheet pan", "other"]);
    expect(groups.find((g) => g.key === "sheet pan")?.meals).toHaveLength(2);
  });
});

describe("uniqueCatalogMeals", () => {
  it("keeps one card per title, preferring stars then newest", () => {
    const meals = [
      meal({ id: "old", title: "Chili", stars: 1, createdAt: "2026-01-01T00:00:00.000Z" }),
      meal({ id: "star", title: "Chili", stars: 5, createdAt: "2026-01-02T00:00:00.000Z" }),
      meal({ id: "copy", title: "chili!", stars: 5, createdAt: "2026-01-03T00:00:00.000Z" }),
      meal({ id: "left", title: "Chili", leftover: true, stars: 5 }),
    ];
    expect(uniqueCatalogMeals(meals).map((item) => item.id)).toEqual(["copy"]);
  });
});

describe("sortCatalogMeals", () => {
  it("sorts loved by stars then createdAt", () => {
    const meals = [
      meal({ id: "a", stars: 2, createdAt: "2026-08-12T00:00:00.000Z" }),
      meal({ id: "b", stars: 5, createdAt: "2026-08-10T00:00:00.000Z" }),
      meal({ id: "c", stars: 5, createdAt: "2026-08-11T00:00:00.000Z" }),
    ];
    expect(sortCatalogMeals(meals, "loved").map((m) => m.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts fast by cookMinutes then title", () => {
    expect(
      sortCatalogMeals(
        [meal({ id: "a", cookMinutes: 40 }), meal({ id: "b", cookMinutes: 12 })],
        "fast",
      ).map((m) => m.id),
    ).toEqual(["b", "a"]);
  });
});

describe("mealMatchesChip", () => {
  it("chip quick is cookMinutes <= 20", () => {
    expect(mealMatchesChip(meal({ cookMinutes: 20 }), "quick", [])).toBe(true);
    expect(mealMatchesChip(meal({ cookMinutes: 21 }), "quick", [])).toBe(false);
  });

  it("chip sheet matches sheet/skillet/stovetop method", () => {
    expect(
      mealMatchesChip(meal({ method: "cast-iron skillet" }), "sheet", []),
    ).toBe(true);
    expect(mealMatchesChip(meal({ method: "oven bake" }), "sheet", [])).toBe(
      false,
    );
  });

  it("chip slow matches slow cooker / crock / instant pot", () => {
    expect(mealMatchesChip(meal({ method: "Instant Pot" }), "slow", [])).toBe(
      true,
    );
  });

  it("chip safe hides allergen hits", () => {
    const shrimp = meal({
      ingredients: [{ name: "shrimp", quantity: "1", unit: "lb", aisle: "meat" }],
    });
    expect(mealMatchesChip(shrimp, "safe", ["shrimp"])).toBe(false);
    expect(mealMatchesChip(meal(), "safe", ["shrimp"])).toBe(true);
  });
});

