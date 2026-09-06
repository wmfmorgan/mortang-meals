import { describe, expect, it } from "vitest";
import { generateLibraryMeals, parseAvoidanceList } from "./generate-library";
import type {
  AdapterRequest,
  AdapterResult,
  GeneratedMeal,
  Household,
  KitchenItem,
} from "@/lib/types";

const household: Household = {
  id: "h1",
  name: "Mortang",
  dietStyle: "ignored",
  notes: "ignored notes",
  servings: 2,
  people: [
    {
      id: "p1",
      name: "Alex",
      age: 40,
      sex: "male",
      allergies: ["shrimp"],
      avoidances: ["cilantro"],
    },
  ],
};

const kitchen: KitchenItem[] = [];
const settings = {
  mode: "grok" as const,
  baseUrl: "https://api.x.ai/v1",
  model: "grok-4.6",
};

function fakeAdapter(queue: AdapterResult[]) {
  const requests: AdapterRequest[] = [];
  return {
    requests,
    async complete(req: AdapterRequest): Promise<AdapterResult> {
      requests.push(req);
      const next = queue.shift();
      if (!next) throw new Error("fakeAdapter queue empty");
      return next;
    },
  };
}

function dinner(title: string, protein = "chicken"): GeneratedMeal {
  return {
    day: "monday",
    slot: "dinner",
    title,
    whyItFits: "Fits",
    cookMinutes: 30,
    method: "stovetop",
    ingredients: [{ name: protein, quantity: "1", unit: "lb", aisle: "meat" }],
    steps: ["Cook"],
  };
}

describe("parseAvoidanceList", () => {
  it("splits commas and lines", () => {
    expect(parseAvoidanceList("pork, shellfish\npeanuts")).toEqual([
      "pork",
      "shellfish",
      "peanuts",
    ]);
  });
});

describe("generateLibraryMeals", () => {
  it("returns the requested count for a slot", async () => {
    const adapter = fakeAdapter([
      {
        ok: true,
        text: JSON.stringify({
          meals: [dinner("Chili"), dinner("Tacos", "beef")],
        }),
      },
    ]);
    const result = await generateLibraryMeals({
      household,
      kitchen,
      groups: [{ slot: "dinner", count: 2, diet: "high-protein", avoidances: "" }],
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meals).toHaveLength(2);
  });

  it("retries then fails when an avoidance ingredient is used", async () => {
    const pork = dinner("Pork chops", "pork");
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ meals: [pork] }) },
      { ok: true, text: JSON.stringify({ meals: [pork] }) },
    ]);
    const result = await generateLibraryMeals({
      household,
      kitchen,
      groups: [{ slot: "dinner", count: 1, diet: "high-protein", avoidances: "pork" }],
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });
    expect(result).toEqual({
      ok: false,
      message: "Couldn’t get usable recipes, try again.",
    });
  });

  it("puts a one-recipe request in the user message", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ meals: [dinner("Spaghetti sauce")] }) },
    ]);
    await generateLibraryMeals({
      household,
      kitchen,
      groups: [{ slot: "dinner", count: 1, diet: "italian", avoidances: "" }],
      request: { slot: "dinner", text: "spaghetti sauce" },
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });
    expect(adapter.requests[0].messages[1].content.toLowerCase()).toContain(
      "spaghetti sauce",
    );
  });

  it("overrides household diet and treats form avoidances as hard excludes", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ meals: [dinner("Keto chili")] }) },
    ]);
    await generateLibraryMeals({
      household,
      kitchen,
      prefs: {
        expertise: "intermediate",
        overallDiet: "kitchen diet",
        breakfastDiet: "",
        lunchDiet: "",
        dinnerDiet: "vegetarian",
        maxCookMinutes: 45,
        involved: "medium",
      },
      groups: [
        { slot: "dinner", count: 1, diet: "keto", avoidances: "pork" },
      ],
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });
    const system = adapter.requests[0].messages[0].content;
    expect(system).toContain("keto");
    expect(system).toContain("Never use pork");
    expect(system).toContain("Never use shrimp");
    expect(system).not.toContain("Focusing on a");
    expect(system).not.toContain("kitchen diet");
    expect(system).not.toContain("Prefer to avoid cilantro");
    expect(system).not.toContain("Fill only these slots");
  });

  it("retries then fails when a reserved title is repeated", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ meals: [dinner("Chili")] }) },
      { ok: true, text: JSON.stringify({ meals: [dinner("Chili")] }) },
    ]);
    const result = await generateLibraryMeals({
      household,
      kitchen,
      groups: [{ slot: "dinner", count: 1, diet: "high-protein", avoidances: "" }],
      reservedTitles: ["Chili"],
      adapter,
      logTrace: () => {},
      settings,
    });
    expect(result).toEqual({
      ok: false,
      message: "Couldn’t get usable recipes, try again.",
    });
  });
});
