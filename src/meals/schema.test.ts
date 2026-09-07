import { describe, expect, it } from "vitest";
import {
  mealEditSchema,
  normalizeSourceUrl,
  parseExtraRecipeResponse,
  parseExtraSuggestionResponse,
  parseLibraryMealsResponse,
  parseMealsResponse,
  parseSingleMealResponse,
  singleMealJsonSchema,
} from "./schema";

const validMeal = {
  day: "monday",
  slot: "dinner",
  title: "Lemon herb salmon",
  whyItFits: "High-protein Mediterranean, sheet pan",
  cookMinutes: 35,
  method: "sheet pan",
  ingredients: [
    { name: "salmon fillets", quantity: "2", unit: "count", aisle: "meat" },
  ],
  steps: ["Heat oven to 425°F", "Roast 15 minutes"],
};

describe("parseMealsResponse", () => {
  it("parses a valid meals payload", () => {
    const result = parseMealsResponse(JSON.stringify({ meals: [validMeal] }));
    expect(result).toEqual({ ok: true, meals: [validMeal] });
  });

  it("returns invalid-json for non-JSON text", () => {
    expect(parseMealsResponse("not json")).toEqual({
      ok: false,
      reason: "invalid-json",
    });
  });

  it("keeps the last recipe list when web search concatenates JSON objects", () => {
    const glued = `{"meals": []}{"meals": []}{"meals": [${JSON.stringify(validMeal)}]}`;
    const result = parseMealsResponse(glued);
    expect(result).toEqual({ ok: true, meals: [validMeal] });
  });

  it("keeps recipes when an empty meals object is glued on the end", () => {
    const glued = `{"meals": [${JSON.stringify(validMeal)}]}{"meals": []}`;
    expect(parseMealsResponse(glued)).toEqual({ ok: true, meals: [validMeal] });
  });

  it("returns schema for invalid day enum", () => {
    expect(
      parseMealsResponse(
        JSON.stringify({ meals: [{ ...validMeal, day: "funday" }] }),
      ),
    ).toEqual({ ok: false, reason: "schema" });
  });

  it("accepts a fractional quantity string", () => {
    const meal = {
      ...validMeal,
      ingredients: [
        ...validMeal.ingredients,
        { name: "salt", quantity: "1/2", unit: "tsp", aisle: "pantry" },
      ],
    };
    const result = parseMealsResponse(JSON.stringify({ meals: [meal] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meals[0].ingredients.at(-1)).toEqual({
        name: "salt",
        quantity: "1/2",
        unit: "tsp",
        aisle: "pantry",
      });
    }
  });

  it("strips extra top-level keys on success", () => {
    const result = parseMealsResponse(
      JSON.stringify({ meals: [validMeal], extra: true }),
    );
    expect(result).toEqual({ ok: true, meals: [validMeal] });
    if (result.ok) {
      expect(Object.keys(result)).toEqual(["ok", "meals"]);
    }
  });
});

describe("parseLibraryMealsResponse", () => {
  it("accepts a dessert recipe that week generate would reject", () => {
    const dessert = { ...validMeal, slot: "dessert" };
    expect(parseMealsResponse(JSON.stringify({ meals: [dessert] }))).toEqual({
      ok: false,
      reason: "schema",
    });
    expect(parseLibraryMealsResponse(JSON.stringify({ meals: [dessert] }))).toEqual({
      ok: true,
      meals: [dessert],
    });
  });
});

describe("parseSingleMealResponse", () => {
  it("parses a valid single meal payload", () => {
    const result = parseSingleMealResponse(JSON.stringify({ meal: validMeal }));
    expect(result).toEqual({ ok: true, meal: validMeal });
  });

  it("keeps the swap JSON schema wrapped as { meal }", () => {
    expect(singleMealJsonSchema.required).toEqual(["meal"]);
    expect(singleMealJsonSchema.properties.meal).toBeDefined();
  });
});

describe("parseExtraSuggestionResponse", () => {
  it("parses a title", () => {
    expect(parseExtraSuggestionResponse(JSON.stringify({ title: "Baked potato" }))).toEqual({
      ok: true,
      title: "Baked potato",
    });
  });

  it("returns schema for a blank title", () => {
    expect(parseExtraSuggestionResponse(JSON.stringify({ title: "" }))).toEqual({
      ok: false,
      reason: "schema",
    });
  });
});

describe("parseExtraRecipeResponse", () => {
  it("parses a recipe without day or slot", () => {
    const extra = {
      title: "Baked potato",
      whyItFits: "Simple starch",
      cookMinutes: 45,
      method: "oven",
      ingredients: [
        { name: "russet potato", quantity: "2", unit: "count", aisle: "produce" },
      ],
      steps: ["Bake at 425°F"],
    };
    expect(parseExtraRecipeResponse(JSON.stringify(extra))).toEqual({
      ok: true,
      extra,
    });
  });
});

describe("sourceUrl on generate JSON", () => {
  it("parses an https sourceUrl", () => {
    const result = parseMealsResponse(
      JSON.stringify({
        meals: [{ ...validMeal, sourceUrl: "https://example.com/salmon" }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meals[0]?.sourceUrl).toBe("https://example.com/salmon");
    }
  });

  it("parses a null sourceUrl", () => {
    const result = parseSingleMealResponse(
      JSON.stringify({ meal: { ...validMeal, sourceUrl: null } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meal.sourceUrl).toBeNull();
    }
  });
});

describe("normalizeSourceUrl", () => {
  it("keeps http and https URLs when web search is on", () => {
    expect(
      normalizeSourceUrl("https://example.com/pie", true),
    ).toBe("https://example.com/pie");
    expect(normalizeSourceUrl("http://example.com/pie", true)).toBe(
      "http://example.com/pie",
    );
  });

  it("drops empty, junk, and non-http schemes", () => {
    expect(normalizeSourceUrl("", true)).toBeNull();
    expect(normalizeSourceUrl("not-a-url", true)).toBeNull();
    expect(normalizeSourceUrl("javascript:alert(1)", true)).toBeNull();
    expect(normalizeSourceUrl(null, true)).toBeNull();
  });

  it("always returns null when web search is off", () => {
    expect(
      normalizeSourceUrl("https://example.com/invented", false),
    ).toBeNull();
  });
});

describe("mealEditSchema", () => {
  it("rejects an empty title or no ingredients", () => {
    const { day: _day, slot: _slot, ...edit } = validMeal;
    expect(mealEditSchema.safeParse({ ...edit, title: "" }).success).toBe(false);
    expect(mealEditSchema.safeParse({ ...edit, ingredients: [] }).success).toBe(
      false,
    );
    expect(mealEditSchema.safeParse(edit).success).toBe(true);
  });
});
