// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cookExit, cookMealHref } from "./cook-exit";

describe("cookMealHref", () => {
  it("sends Plans Cook to from=plans", () => {
    expect(cookMealHref("meal-salmon", "plans")).toBe(
      "/meals/meal-salmon?from=plans",
    );
  });

  it("keeps the open week on Plans Cook", () => {
    expect(cookMealHref("meal-salmon", "plans", "plan-1")).toBe(
      "/meals/meal-salmon?from=plans&plan=plan-1",
    );
  });

  it("sends Meals Cook to from=meals", () => {
    expect(cookMealHref("meal-salmon", "meals")).toBe(
      "/meals/meal-salmon?from=meals",
    );
  });
});

describe("cookExit", () => {
  it("returns to Plans from from=plans", () => {
    expect(cookExit("plans")).toEqual({
      href: "/",
      label: "Exit to Plans",
    });
  });

  it("returns to the open week when plan is present", () => {
    expect(cookExit("plans", "plan-1")).toEqual({
      href: "/?plan=plan-1",
      label: "Exit to Plans",
    });
  });

  it("returns to the library from from=meals", () => {
    expect(cookExit("meals")).toEqual({
      href: "/meals",
      label: "Exit to Library",
    });
  });

  it("defaults missing or invalid from to the library", () => {
    expect(cookExit(undefined).href).toBe("/meals");
    expect(cookExit("nope").label).toBe("Exit to Library");
    expect(cookExit(["plans", "meals"]).href).toBe("/meals");
  });
});
