import { describe, expect, it } from "vitest";
import {
  EMPTY_EXTRAS,
  extraFromMeal,
  parseMealExtras,
  suggestionExtra,
} from "./extras";

describe("parseMealExtras", () => {
  it("returns empty extras for missing or blank JSON", () => {
    expect(parseMealExtras(undefined)).toEqual(EMPTY_EXTRAS);
    expect(parseMealExtras(null)).toEqual(EMPTY_EXTRAS);
    expect(parseMealExtras("")).toEqual(EMPTY_EXTRAS);
    expect(parseMealExtras("{}")).toEqual(EMPTY_EXTRAS);
  });

  it("returns empty extras for invalid JSON", () => {
    expect(parseMealExtras("{")).toEqual(EMPTY_EXTRAS);
    expect(parseMealExtras("not-json")).toEqual(EMPTY_EXTRAS);
  });

  it("parses a side suggestion and a dessert recipe", () => {
    const side = suggestionExtra({
      id: "extra-side",
      kind: "side",
      title: "Baked potato",
    });
    const dessert = {
      id: "extra-dessert",
      kind: "dessert" as const,
      mode: "recipe" as const,
      title: "Key lime pie",
      whyItFits: "Bright finish",
      cookMinutes: 20,
      method: "no bake",
      ingredients: [
        { name: "lime juice", quantity: "1/2", unit: "cup", aisle: "produce" as const },
      ],
      steps: ["Mix", "Chill"],
      usedWebSearch: false,
      sourceUrl: null,
    };

    expect(
      parseMealExtras(
        JSON.stringify({
          side,
          dessert,
        }),
      ),
    ).toEqual({ side, dessert });
  });

  it("copies a saved recipe onto an extra", () => {
    const extra = extraFromMeal(
      {
        id: "lib-potato",
        title: "Baked potato",
        whyItFits: "Simple starch",
        cookMinutes: 45,
        method: "oven",
        ingredients: [
          { name: "russet potato", quantity: "2", unit: "count", aisle: "produce" },
        ],
        steps: ["Bake"],
        usedWebSearch: true,
        sourceUrl: "https://example.com/potato",
      },
      "side",
    );
    expect(extra).toMatchObject({
      id: "lib-potato",
      kind: "side",
      mode: "recipe",
      title: "Baked potato",
      cookMinutes: 45,
      usedWebSearch: true,
      sourceUrl: "https://example.com/potato",
    });
  });

  it("drops a malformed extra and keeps the other", () => {
    const side = suggestionExtra({
      id: "extra-side",
      kind: "side",
      title: "Rice",
    });
    expect(
      parseMealExtras(
        JSON.stringify({
          side,
          dessert: { title: "Pie" },
        }),
      ),
    ).toEqual({ side, dessert: null });
  });
});
