import { describe, expect, it } from "vitest";
import { scaleIngredients } from "./scale-servings";

const salmon = {
  name: "salmon",
  quantity: "1",
  unit: "lb",
  aisle: "meat" as const,
};

describe("scaleIngredients", () => {
  it("doubles parseable quantities when servings double", () => {
    expect(scaleIngredients([salmon], 2, 4)[0]?.quantity).toBe("2");
  });

  it("scales mixed fractions", () => {
    const flour = { ...salmon, name: "flour", quantity: "1 1/2", unit: "cup", aisle: "pantry" as const };
    expect(scaleIngredients([flour], 2, 4)[0]?.quantity).toBe("3");
  });

  it("leaves unparseable quantities unchanged", () => {
    const pinch = { ...salmon, name: "salt", quantity: "pinch", unit: "", aisle: "pantry" as const };
    expect(scaleIngredients([pinch], 2, 4)[0]?.quantity).toBe("pinch");
  });

  it("treats fromServings below 1 as 1", () => {
    expect(scaleIngredients([salmon], 0, 2)[0]?.quantity).toBe("2");
  });
});
