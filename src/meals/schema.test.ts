import { describe, expect, it } from "vitest";
import { parseMealsResponse, parseSingleMealResponse } from "./schema";

const validMeal = {
  day: "monday",
  slot: "dinner",
  title: "Lemon herb salmon",
  whyItFits: "High-protein Mediterranean, sheet pan",
  cookMinutes: 35,
  method: "sheet pan",
  ingredients: [
    { name: "salmon fillets", quantity: 2, unit: "count", aisle: "meat" },
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

  it("returns schema for invalid day enum", () => {
    expect(
      parseMealsResponse(
        JSON.stringify({ meals: [{ ...validMeal, day: "funday" }] }),
      ),
    ).toEqual({ ok: false, reason: "schema" });
  });

  it("accepts a pinch ingredient with quantity 0", () => {
    const meal = {
      ...validMeal,
      ingredients: [
        ...validMeal.ingredients,
        { name: "salt", quantity: 0, unit: "tsp", aisle: "pantry" },
      ],
    };
    const result = parseMealsResponse(JSON.stringify({ meals: [meal] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meals[0].ingredients.at(-1)).toEqual({
        name: "salt",
        quantity: 0,
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

describe("parseSingleMealResponse", () => {
  it("parses a valid single meal payload", () => {
    const result = parseSingleMealResponse(JSON.stringify({ meal: validMeal }));
    expect(result).toEqual({ ok: true, meal: validMeal });
  });
});
