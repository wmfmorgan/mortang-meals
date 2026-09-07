import { describe, expect, it } from "vitest";
import {
  generateLibraryMeals,
  parseAvoidanceList,
  reservedTitlesForSlots,
} from "./generate-library";
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

function extraRecipe(
  slot: "side" | "dessert",
  title: string,
  ingredient = "zucchini",
): GeneratedMeal {
  return {
    ...dinner(title, ingredient),
    slot,
    ingredients: [
      { name: ingredient, quantity: "1", unit: "cup", aisle: "produce" },
    ],
  };
}

describe("reservedTitlesForSlots", () => {
  it("only lists titles for the slots being generated", () => {
    expect(
      reservedTitlesForSlots(
        [
          { slot: "dinner", title: "Crispy BBQ Baked Chicken Thighs" },
          { slot: "lunch", title: "Grandma chili" },
          { slot: "dessert", title: "Peanut butter cookies" },
          { slot: "dessert", title: "Easy Dairy-Free Custard" },
        ],
        ["dessert"],
      ),
    ).toEqual(["Peanut butter cookies", "Easy Dairy-Free Custard"]);
  });
});

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

  it("generates dessert recipes and applies dessert criteria as hard excludes", async () => {
    const dessert = extraRecipe("dessert", "Coconut berry cups", "coconut");
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ meals: [dessert] }) },
    ]);
    const result = await generateLibraryMeals({
      household,
      kitchen,
      groups: [
        {
          slot: "dessert",
          count: 1,
          diet: "low-sugar, gluten-free, dairy-free",
          avoidances: "",
        },
      ],
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meals[0]?.slot).toBe("dessert");
    const system = adapter.requests[0]!.messages[0]!.content;
    expect(system).toMatch(/sugar/i);
    expect(system).toMatch(/gluten/i);
    expect(system).toMatch(/dairy/i);
    expect(system).toContain("Never use sugar");
    expect(system).toContain("Never use butter");
  });

  it("accepts peanut butter in a dairy-free dessert", async () => {
    const cookies = extraRecipe(
      "dessert",
      "3-Ingredient Peanut Butter Cookies",
      "smooth peanut butter",
    );
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ meals: [cookies] }) },
    ]);
    const result = await generateLibraryMeals({
      household,
      kitchen,
      groups: [
        { slot: "dessert", count: 1, diet: "dairy-free", avoidances: "" },
      ],
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });
    expect(result.ok).toBe(true);
  });

  it("retries then fails a dairy-free dessert that uses butter", async () => {
    const butter = extraRecipe("dessert", "Butter tart", "butter");
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ meals: [butter] }) },
      { ok: true, text: JSON.stringify({ meals: [butter] }) },
    ]);
    const result = await generateLibraryMeals({
      household,
      kitchen,
      groups: [
        {
          slot: "dessert",
          count: 1,
          diet: "dairy-free",
          avoidances: "",
        },
      ],
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

  it("generates side recipes", async () => {
    const side = extraRecipe("side", "Garlic green beans", "green beans");
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ meals: [side] }) },
    ]);
    const result = await generateLibraryMeals({
      household,
      kitchen,
      groups: [{ slot: "side", count: 1, diet: "keto", avoidances: "" }],
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meals[0]?.slot).toBe("side");
  });

  it("keeps desserts from concatenated web-search JSON", async () => {
    const dessert = extraRecipe("dessert", "Easy Dairy-Free Custard", "coconut");
    const glued =
      '{"meals": []}{"meals": []}' +
      JSON.stringify({ meals: [dessert] });
    const adapter = fakeAdapter([{ ok: true, text: glued }]);
    const result = await generateLibraryMeals({
      household,
      kitchen,
      groups: [
        {
          slot: "dessert",
          count: 1,
          diet: "dairy-free",
          avoidances: "",
        },
      ],
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.meals[0]?.title).toBe("Easy Dairy-Free Custard");
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
