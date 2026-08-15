import { describe, expect, it } from "vitest";
import { buildHouseholdBrief } from "./brief";
import type { Household, KitchenItem, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";

function emptyMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((d) => [d, Object.fromEntries(SLOTS.map((s) => [s, false]))]),
  ) as SlotMask;
}

const household: Household = {
  id: "h1",
  name: "Mortang",
  dietStyle: "high-protein Mediterranean",
  notes: "Weeknight dinners under 45 minutes when possible.",
  servings: 2,
  people: [
    {
      id: "p1",
      name: "Alex",
      age: 53,
      sex: "male",
      allergies: ["shellfish"],
      avoidances: [],
    },
    {
      id: "p2",
      name: "Sam",
      age: 53,
      sex: "female",
      allergies: [],
      avoidances: ["cilantro"],
    },
  ],
};

const kitchen: KitchenItem[] = [
  { id: "k1", name: "sheet pan", kind: "method", enabled: true, builtIn: true },
  { id: "k2", name: "crockpot", kind: "appliance", enabled: true, builtIn: true },
  { id: "k3", name: "grill", kind: "method", enabled: false, builtIn: true },
];

describe("buildHouseholdBrief", () => {
  it("describes people, diet, hard allergies, soft avoidances, enabled kitchen, slots, servings", () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    const brief = buildHouseholdBrief({ household, kitchen, slotMask: mask });
    expect(brief).toContain("53-year-old man");
    expect(brief).toContain("53-year-old woman");
    expect(brief).toContain("high-protein Mediterranean");
    expect(brief).toContain("Never use shellfish (Alex)");
    expect(brief).toContain("Prefer to avoid cilantro (Sam)");
    expect(brief).toContain("sheet pan");
    expect(brief).toContain("crockpot");
    expect(brief).not.toContain("grill");
    expect(brief).toContain("monday dinner");
    expect(brief).toContain("Servings: 2");
    expect(brief).toContain("Weeknight dinners under 45 minutes");
  });

  it("adds kitchen prefs, slot diet overrides, time, and involvement", () => {
    const mask = emptyMask();
    mask.monday.breakfast = true;
    mask.monday.dinner = true;
    const brief = buildHouseholdBrief({
      household,
      kitchen,
      slotMask: mask,
      prefs: {
        expertise: "newbie",
        overallDiet: "Mediterranean",
        breakfastDiet: "high-protein",
        lunchDiet: "",
        dinnerDiet: "vegetarian",
        maxCookMinutes: 30,
        involved: "low",
      },
    });
    expect(brief).toContain("Cook for a newbie");
    expect(brief).toContain("How involved: low");
    expect(brief).toContain("Keep cookMinutes at or under 30");
    expect(brief).toContain("breakfast diet: high-protein");
    expect(brief).toContain("dinner diet: vegetarian");
    expect(brief).not.toContain("lunch diet");
  });

  it("asks for a featured ingredient on the assigned slot only", () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    const brief = buildHouseholdBrief({
      household,
      kitchen,
      slotMask: mask,
      useIngredients: [
        { name: "chicken", day: "monday", slot: "dinner" },
        { name: "ignored", day: "wednesday", slot: "lunch" },
      ],
    });
    expect(brief).toContain(
      "monday dinner must feature chicken as a main ingredient.",
    );
    expect(brief).not.toContain("wednesday lunch");
  });
});
