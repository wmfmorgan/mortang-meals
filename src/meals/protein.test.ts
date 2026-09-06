import { describe, expect, it } from "vitest";
import { mealProtein } from "./protein";

describe("mealProtein", () => {
  it("finds chicken in an ingredient name", () => {
    expect(
      mealProtein([{ name: "boneless chicken thighs" }]),
    ).toBe("chicken");
  });

  it("does not treat eggplant as egg", () => {
    expect(mealProtein([{ name: "eggplant" }])).toBeNull();
  });

  it("returns the first listed protein", () => {
    expect(
      mealProtein([{ name: "chicken" }, { name: "beef" }]),
    ).toBe("chicken");
  });
});
