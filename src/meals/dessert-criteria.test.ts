import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESSERT_DIET,
  DESSERT_CRITERIA,
  dessertCriteriaFromDiet,
} from "./dessert-criteria";

describe("dessertCriteriaFromDiet", () => {
  it("defaults include low sugar, gluten-free, and dairy-free", () => {
    expect(DEFAULT_DESSERT_DIET).toContain("low-sugar");
    expect(DEFAULT_DESSERT_DIET).toContain("gluten-free");
    expect(DEFAULT_DESSERT_DIET).toContain("dairy-free");
    expect(DESSERT_CRITERIA).toEqual(
      expect.arrayContaining([
        "low-sugar",
        "gluten-free",
        "dairy-free",
        "nut-free",
        "egg-free",
        "refined-sugar-free",
        "keto",
      ]),
    );
  });

  it("turns selected dessert criteria into prompt rules and hard excludes", () => {
    const result = dessertCriteriaFromDiet(
      "low-sugar, gluten-free, dairy-free",
    );
    expect(result.rules.some((rule) => /sugar/i.test(rule))).toBe(true);
    expect(result.rules.some((rule) => /gluten/i.test(rule))).toBe(true);
    expect(result.rules.some((rule) => /dairy/i.test(rule))).toBe(true);
    expect(result.excludes).toEqual(
      expect.arrayContaining(["sugar", "wheat", "butter", "milk"]),
    );
  });

  it("ignores unknown tokens", () => {
    expect(dessertCriteriaFromDiet("fancy").excludes).toEqual([]);
  });
});
