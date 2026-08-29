import { describe, expect, it } from "vitest";
import { EMPTY_EXTRAS, parseMealExtras, suggestionExtra } from "./extras";

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
