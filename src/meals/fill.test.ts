import { describe, expect, it } from "vitest";
import type { Meal, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { EMPTY_EXTRAS } from "./extras";
import { mealProtein } from "./protein";
import { pickFillMeals } from "./fill";

function emptyMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((day) => [day, Object.fromEntries(SLOTS.map((slot) => [slot, false]))]),
  ) as SlotMask;
}

function recipe(
  title: string,
  protein: string,
  slot: Meal["slot"] = "dinner",
  stars = 0,
): Meal {
  return {
    id: title,
    planId: "",
    day: "monday",
    slot,
    title,
    whyItFits: "",
    cookMinutes: 30,
    method: "stovetop",
    ingredients: [{ name: protein, quantity: "1", unit: "lb", aisle: "meat" }],
    steps: ["Cook"],
    usedWebSearch: false,
    pinned: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    sourceUrl: null,
    extras: EMPTY_EXTRAS,
    draft: false,
    stars,
    takeout: false,
    leftover: false,
  };
}

describe("pickFillMeals", () => {
  it("fills dinners preferring higher stars and unique titles", () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    const picks = pickFillMeals({
      mask,
      occupied: [],
      library: [
        recipe("Chili", "beef", "dinner", 2),
        recipe("Tacos", "beef", "dinner", 5),
      ],
      allergies: [],
      maxCookMinutes: 45,
      allowRepeats: false,
      leftoverLunches: false,
      maxProtein: 0,
    });
    expect(picks.map((pick) => pick.source.title)).toEqual(["Tacos", "Chili"]);
  });

  it("caps a protein at two appearances", () => {
    const mask = emptyMask();
    for (const day of DAYS) mask[day].dinner = true;
    const library = [
      recipe("Chicken 1", "chicken", "dinner", 5),
      recipe("Chicken 2", "chicken", "dinner", 4),
      recipe("Chicken 3", "chicken", "dinner", 3),
      recipe("Salmon", "salmon", "dinner", 1),
    ];
    const picks = pickFillMeals({
      mask,
      occupied: [],
      library,
      allergies: [],
      maxCookMinutes: 45,
      allowRepeats: true,
      leftoverLunches: false,
      maxProtein: 2,
    });
    const chicken = picks.filter((pick) =>
      pick.source.title.startsWith("Chicken"),
    );
    expect(chicken).toHaveLength(2);
    expect(picks.some((pick) => pick.source.title === "Salmon")).toBe(true);
  });

  it("skips pinned/occupied cells and takeout", () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    const takeout = {
      ...recipe("Thai", "chicken"),
      day: "monday" as const,
      takeout: true,
      ingredients: [],
    };
    const picks = pickFillMeals({
      mask,
      occupied: [takeout],
      library: [recipe("Chili", "beef")],
      allergies: [],
      maxCookMinutes: 45,
      allowRepeats: false,
      leftoverLunches: false,
      maxProtein: 2,
    });
    expect(picks).toHaveLength(1);
    expect(picks[0]?.day).toBe("tuesday");
  });

  it("caps protein per breakfast/lunch/dinner row, not the whole week", () => {
    const mask = emptyMask();
    for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"] as const) {
      mask[day].dinner = true;
    }
    const leftover = {
      ...recipe("Thighs", "chicken"),
      day: "friday" as const,
      slot: "lunch" as const,
      leftover: true,
    };
    const picks = pickFillMeals({
      mask,
      occupied: [leftover],
      library: [
        recipe("Thighs", "chicken", "dinner", 5),
        recipe("Skillet", "chicken", "dinner", 4),
        recipe("Salmon", "salmon", "dinner", 3),
        recipe("Tuna", "tuna", "dinner", 2),
        recipe("Cod", "cod", "dinner", 1),
      ],
      allergies: [],
      maxCookMinutes: 45,
      allowRepeats: false,
      leftoverLunches: false,
      maxProtein: 2,
    });
    expect(picks).toHaveLength(5);
    expect(
      picks.filter((pick) =>
        mealProtein(pick.source.ingredients) === "chicken",
      ),
    ).toHaveLength(2);
  });

  it("can leftover monday dinner onto tuesday lunch", () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.lunch = true;
    const dinner = { ...recipe("Chili", "beef"), day: "monday" as const };
    const picks = pickFillMeals({
      mask,
      occupied: [dinner],
      library: [],
      allergies: [],
      maxCookMinutes: 45,
      allowRepeats: false,
      leftoverLunches: true,
      maxProtein: 2,
    });
    expect(picks).toEqual([
      { day: "tuesday", slot: "lunch", source: dinner, leftover: true },
    ]);
  });

  it("leftover lunches copy dinners filled on this plan in the same pass", () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.lunch = true;
    const chili = recipe("Chili", "beef");
    const picks = pickFillMeals({
      mask,
      occupied: [],
      library: [chili],
      allergies: [],
      maxCookMinutes: 45,
      allowRepeats: false,
      leftoverLunches: true,
      maxProtein: 2,
    });
    expect(picks).toEqual([
      { day: "monday", slot: "dinner", source: chili, leftover: false },
      { day: "tuesday", slot: "lunch", source: chili, leftover: true },
    ]);
  });

  it("does not place leftover copies from the library", () => {
    const mask = emptyMask();
    mask.monday.lunch = true;
    const leftover = {
      ...recipe("Thighs", "chicken", "lunch"),
      leftover: true,
      day: "friday" as const,
    };
    const picks = pickFillMeals({
      mask,
      occupied: [],
      library: [leftover],
      allergies: [],
      maxCookMinutes: 45,
      allowRepeats: false,
      leftoverLunches: true,
      maxProtein: 2,
    });
    expect(picks).toEqual([]);
  });

  it("allow repeats, protein, and leftover lunches ignore other-plan occupants", () => {
    const mask = emptyMask();
    for (const day of ["monday", "tuesday", "wednesday"] as const) {
      mask[day].dinner = true;
    }
    mask.tuesday.lunch = true;
    const otherWeekLeftover = {
      ...recipe("Thighs", "chicken", "lunch"),
      leftover: true,
      day: "friday" as const,
    };
    const thighs = recipe("Thighs", "chicken", "dinner", 5);
    const skillet = recipe("Skillet", "chicken", "dinner", 4);
    const salmon = recipe("Salmon", "salmon", "dinner", 3);
    const picks = pickFillMeals({
      mask,
      occupied: [],
      library: [otherWeekLeftover, thighs, skillet, salmon],
      allergies: [],
      maxCookMinutes: 45,
      allowRepeats: false,
      leftoverLunches: true,
      maxProtein: 2,
    });
    expect(picks.filter((pick) => pick.slot === "dinner")).toHaveLength(3);
    expect(picks.some((pick) => pick.source.title === "Thighs" && !pick.leftover)).toBe(
      true,
    );
    expect(
      picks.filter((pick) => mealProtein(pick.source.ingredients) === "chicken" && !pick.leftover),
    ).toHaveLength(2);
    expect(picks).toContainEqual({
      day: "tuesday",
      slot: "lunch",
      source: thighs,
      leftover: true,
    });
  });
});
