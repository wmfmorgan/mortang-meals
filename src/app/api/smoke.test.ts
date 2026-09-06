import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveSettings } from "@/ai/settings-repo";
import {
  handleGenerate,
  handleGenerateExtra,
  handleGenerateLibrary,
  handleSwap,
} from "@/ai/http";
import {
  handleApproveDraft,
  handleCreateMeal,
  handleDeleteExtra,
  handleListLibrary,
  handlePlaceExtra,
  handlePlaceMeal,
  handleRateMeal,
  handleRejectDraft,
} from "@/meals/http";
import { getHousehold, replacePeople, upsertHousehold } from "@/household/repo";
import { seedKitchenIfEmpty } from "@/kitchen/repo";
import { resetDbForTests } from "@/lib/db";
import type {
  AdapterRequest,
  AdapterResult,
  DayOfWeek,
  GeneratedMeal,
  Meal,
  ShoppingList,
  SlotMask,
  WeekPlan,
} from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import {
  getCurrentPlan,
  listAllMeals,
  listDraftMeals,
  saveGeneratedPlan,
  setMealExtra,
  setPinned,
  setPlanPinned,
} from "@/meals/repo";
import { suggestionExtra } from "@/meals/extras";
import { mergeShoppingList } from "@/meals/shopping-list";

const dbPath = path.join(
  os.tmpdir(),
  `mortang-api-smoke-${crypto.randomUUID()}.db`,
);

let previousXaiKey: string | undefined;

beforeAll(() => {
  process.env.MORTANG_DB_PATH = dbPath;
  previousXaiKey = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = "test-key";
  resetDbForTests();

  const household = upsertHousehold({
    name: "Mortang",
    dietStyle: "high-protein Mediterranean",
    notes: "",
    servings: 2,
  });
  replacePeople(household.id, [
    {
      name: "Alex",
      age: 53,
      sex: "male",
      allergies: ["shellfish"],
      avoidances: [],
    },
    {
      name: "Sam",
      age: 53,
      sex: "female",
      allergies: [],
      avoidances: ["cilantro"],
    },
  ]);
  seedKitchenIfEmpty();
});

afterAll(() => {
  resetDbForTests();
  if (previousXaiKey === undefined) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = previousXaiKey;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
});

function emptyMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((day) => [day, Object.fromEntries(SLOTS.map((slot) => [slot, false]))]),
  ) as SlotMask;
}

function weekdayDinnerMask(): SlotMask {
  const slotMask = emptyMask();
  for (const day of DAYS) {
    slotMask[day].dinner = true;
  }
  return slotMask;
}

function dinner(
  day: DayOfWeek,
  title: string,
  protein: string,
): GeneratedMeal {
  return {
    day,
    slot: "dinner",
    title,
    whyItFits: "High-protein Mediterranean",
    cookMinutes: 35,
    method: "sheet pan",
    ingredients: [{ name: protein, quantity: "1", unit: "lb", aisle: "meat" }],
    steps: ["Cook"],
  };
}

const WEEK_DINNERS: GeneratedMeal[] = [
  dinner("monday", "Lemon herb salmon", "salmon"),
  dinner("tuesday", "Crockpot chicken", "chicken"),
  dinner("wednesday", "Sheet-pan tofu", "tofu"),
  dinner("thursday", "Air-fryer turkey", "turkey"),
  dinner("friday", "Grilled steak", "steak"),
  dinner("saturday", "Instant Pot chili", "beef"),
  dinner("sunday", "Oven roast lamb", "lamb"),
];

function fakeComplete(queue: AdapterResult[]) {
  const requests: AdapterRequest[] = [];
  async function complete(req: AdapterRequest): Promise<AdapterResult> {
    requests.push(req);
    const next = queue.shift();
    if (!next) throw new Error("fakeAdapter queue empty");
    return next;
  }
  return { complete, requests };
}

describe("API smoke path", () => {
  it("generates seven weekday dinners and persists the current plan", async () => {
    const { complete } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: WEEK_DINNERS }) },
    ]);

    const result = await handleGenerate(
      { weekStart: "2026-08-10", slotMask: weekdayDinnerMask() },
      { complete },
    );

    expect(result.status).toBe(200);
    const body = result.body as { plan: WeekPlan };
    expect(body.plan.meals).toHaveLength(7);
    expect(getCurrentPlan()).toEqual(body.plan);
  });

  it("swaps Monday dinner and returns the shopping list the client would show", async () => {
    const { complete: generateComplete } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: WEEK_DINNERS }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-08-10", slotMask: weekdayDinnerMask() },
      { complete: generateComplete },
    );
    const plan = (generated.body as { plan: WeekPlan }).plan;
    const monday = plan.meals.find((meal) => meal.day === "monday");
    expect(monday).toBeDefined();
    const otherTitles = plan.meals
      .filter((meal) => meal.day !== "monday")
      .map((meal) => meal.title);

    const swapped: GeneratedMeal = {
      ...WEEK_DINNERS[0],
      title: "Sheet-pan trout",
      ingredients: [{ name: "trout", quantity: "1", unit: "lb", aisle: "meat" }],
    };
    const { complete } = fakeComplete([
      { ok: true, text: JSON.stringify({ meal: swapped }) },
    ]);

    const result = await handleSwap(
      { planId: plan.id, mealId: monday!.id },
      { complete },
    );

    expect(result.status).toBe(200);
    const body = result.body as { meal: Meal; shoppingList: ShoppingList };
    expect(body.meal.title).toBe("Sheet-pan trout");

    const current = getCurrentPlan();
    expect(current?.meals.find((meal) => meal.day === "monday")?.title).toBe(
      "Sheet-pan trout",
    );
    expect(
      current?.meals
        .filter((meal) => meal.day !== "monday")
        .map((meal) => meal.title),
    ).toEqual(otherTitles);
    expect(body.shoppingList).toEqual(mergeShoppingList(current!.meals));
  });

  it("swaps with a prompt and still only replaces that meal", async () => {
    const existing = getCurrentPlan();
    expect(existing).toBeTruthy();
    const monday = existing!.meals.find((meal) => meal.day === "monday");
    expect(monday).toBeDefined();
    const otherTitles = existing!.meals
      .filter((meal) => meal.day !== "monday")
      .map((meal) => meal.title);

    const swapped: GeneratedMeal = {
      ...WEEK_DINNERS[0],
      title: "Grilled trout",
      method: "grill",
      ingredients: [{ name: "trout", quantity: "1", unit: "lb", aisle: "meat" }],
    };
    const { complete, requests } = fakeComplete([
      { ok: true, text: JSON.stringify({ meal: swapped }) },
    ]);

    const result = await handleSwap(
      {
        planId: existing!.id,
        mealId: monday!.id,
        prompt: "made on the grill",
      },
      { complete },
    );

    expect(result.status).toBe(200);
    expect((result.body as { meal: Meal }).meal.title).toBe("Grilled trout");
    expect(requests[0]!.messages[1]!.content.toLowerCase()).toContain(
      "made on the grill",
    );
    expect(
      getCurrentPlan()
        ?.meals.filter((meal) => meal.day !== "monday")
        .map((meal) => meal.title),
    ).toEqual(otherTitles);
  });

  it("marks generated meals as usedWebSearch when the Grok toggle is on", async () => {
    saveSettings({ webSearch: true });
    try {
      const { complete } = fakeComplete([
        { ok: true, text: JSON.stringify({ meals: WEEK_DINNERS }) },
      ]);
      const result = await handleGenerate(
        { weekStart: "2026-08-17", slotMask: weekdayDinnerMask() },
        { complete },
      );
      expect(result.status).toBe(200);
      const meals = (result.body as { plan: WeekPlan }).plan.meals;
      expect(meals.every((meal) => meal.usedWebSearch)).toBe(true);
    } finally {
      saveSettings({ webSearch: false });
    }
  });

  it("keeps a pinned dinner and only asks the model for the remaining slots", async () => {
    const { complete: first } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: WEEK_DINNERS }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-08-24", slotMask: weekdayDinnerMask() },
      { complete: first },
    );
    const plan = (generated.body as { plan: WeekPlan }).plan;
    const monday = plan.meals.find((meal) => meal.day === "monday")!;
    setPinned(monday.id, true);

    const rest = WEEK_DINNERS.filter((meal) => meal.day !== "monday").map(
      (meal) => ({ ...meal, title: `New ${meal.title}` }),
    );
    const { complete, requests } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: rest }) },
    ]);
    const result = await handleGenerate(
      { weekStart: "2026-08-24", slotMask: weekdayDinnerMask() },
      { complete },
    );

    expect(result.status).toBe(200);
    const updated = (result.body as { plan: WeekPlan }).plan;
    expect(updated.id).toBe(plan.id);
    expect(updated.meals.find((meal) => meal.day === "monday")?.title).toBe(
      monday.title,
    );
    expect(updated.meals.find((meal) => meal.day === "tuesday")?.title).toBe(
      "New Crockpot chicken",
    );
    expect(requests[0]!.messages[1]!.content).not.toMatch(/monday dinner/i);
    expect(requests[0]!.messages[1]!.content).toMatch(/tuesday dinner/i);
  });

  it("does not call the model when every requested slot is pinned", async () => {
    const existing = getCurrentPlan();
    if (existing) setPlanPinned(existing.id, false);

    const mask = emptyMask();
    mask.monday.dinner = true;
    const { complete: first } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: [WEEK_DINNERS[0]] }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-08-31", slotMask: mask },
      { complete: first },
    );
    const meal = (generated.body as { plan: WeekPlan }).plan.meals[0]!;
    setPinned(meal.id, true);

    let called = false;
    const result = await handleGenerate(
      { weekStart: "2026-08-31", slotMask: mask },
      {
        complete: async () => {
          called = true;
          return { ok: true, text: "{}" };
        },
      },
    );

    expect(result.status).toBe(400);
    expect((result.body as { message: string }).message).toMatch(/pinned/i);
    expect(called).toBe(false);
  });

  it("rejects generate with an empty diet style without calling the adapter", async () => {
    const household = getHousehold();
    expect(household).not.toBeNull();
    upsertHousehold({
      name: household!.name,
      dietStyle: "",
      notes: household!.notes,
      servings: household!.servings,
    });

    try {
      let called = false;
      const complete = async (): Promise<AdapterResult> => {
        called = true;
        return { ok: true, text: "{}" };
      };

      const result = await handleGenerate(
        { slotMask: weekdayDinnerMask() },
        { complete },
      );

      expect(result.status).toBe(400);
      expect((result.body as { message: string }).message).toMatch(/diet style/i);
      expect(called).toBe(false);
    } finally {
      upsertHousehold({
        name: household!.name,
        dietStyle: "high-protein Mediterranean",
        notes: household!.notes,
        servings: household!.servings,
      });
    }
  });

  it("adds a lunch side suggestion and deletes it", async () => {
    const mask = emptyMask();
    mask.monday.lunch = true;
    const { complete: generateComplete } = fakeComplete([
      {
        ok: true,
        text: JSON.stringify({
          meals: [
            {
              ...dinner("monday", "Chicken pita", "chicken"),
              slot: "lunch",
            },
          ],
        }),
      },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-09-07", slotMask: mask },
      { complete: generateComplete },
    );
    const lunch = (generated.body as { plan: WeekPlan }).plan.meals[0]!;

    const { complete } = fakeComplete([
      { ok: true, text: JSON.stringify({ title: "Baked potato" }) },
    ]);
    const added = await handleGenerateExtra(
      { mealId: lunch.id, kind: "side", mode: "suggestion" },
      { complete },
    );
    expect(added.status).toBe(200);
    const withSide = (added.body as { meal: Meal }).meal;
    expect(withSide.extras.side?.title).toBe("Baked potato");
    expect(withSide.extras.side?.mode).toBe("suggestion");

    const deleted = handleDeleteExtra({ mealId: lunch.id, kind: "side" });
    expect(deleted.status).toBe(200);
    expect((deleted.body as { meal: Meal }).meal.extras.side).toBeNull();
  });

  it("rejects extras on breakfast and on a historical plan", async () => {
    const breakfastMask = emptyMask();
    breakfastMask.monday.breakfast = true;
    const { complete: breakfastComplete } = fakeComplete([
      {
        ok: true,
        text: JSON.stringify({
          meals: [
            {
              ...dinner("monday", "Yogurt bowl", "yogurt"),
              slot: "breakfast",
            },
          ],
        }),
      },
    ]);
    const breakfastPlan = await handleGenerate(
      { weekStart: "2026-09-14", slotMask: breakfastMask },
      { complete: breakfastComplete },
    );
    const breakfast = (breakfastPlan.body as { plan: WeekPlan }).plan.meals[0]!;
    const breakfastResult = await handleGenerateExtra(
      { mealId: breakfast.id, kind: "side", mode: "suggestion" },
      {
        complete: async () => ({
          ok: true,
          text: JSON.stringify({ title: "Toast" }),
        }),
      },
    );
    expect(breakfastResult.status).toBe(400);
    expect((breakfastResult.body as { message: string }).message).toMatch(
      /breakfast/i,
    );

    const historical = saveGeneratedPlan({
      weekStart: "2026-01-05",
      slotMask: weekdayDinnerMask(),
      meals: [dinner("monday", "Old salmon", "salmon")],
    });
    saveGeneratedPlan({
      weekStart: "2026-01-12",
      slotMask: weekdayDinnerMask(),
      meals: [dinner("monday", "New trout", "trout")],
    });
    const oldMeal = historical.meals[0]!;
    const historicalResult = await handleGenerateExtra(
      { mealId: oldMeal.id, kind: "dessert", mode: "suggestion" },
      {
        complete: async () => ({
          ok: true,
          text: JSON.stringify({ title: "Pie" }),
        }),
      },
    );
    expect(historicalResult.status).toBe(400);
    expect((historicalResult.body as { message: string }).message).toMatch(
      /this week/i,
    );
  });

  it("leaves a suggestion in place when upgrading the extra recipe fails", async () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    const { complete: generateComplete } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: [WEEK_DINNERS[0]] }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-09-21", slotMask: mask },
      { complete: generateComplete },
    );
    const dinnerMeal = (generated.body as { plan: WeekPlan }).plan.meals[0]!;
    setMealExtra(
      dinnerMeal.id,
      suggestionExtra({
        id: "keep-side",
        kind: "side",
        title: "Baked potato",
      }),
    );

    const shrimpy = {
      title: "Shrimp cocktail",
      whyItFits: "Nope",
      cookMinutes: 10,
      method: "chill",
      ingredients: [
        { name: "shellfish", quantity: "1", unit: "lb", aisle: "meat" },
      ],
      steps: ["Chill"],
    };
    const { complete } = fakeComplete([
      { ok: true, text: JSON.stringify(shrimpy) },
      { ok: true, text: JSON.stringify(shrimpy) },
    ]);
    const result = await handleGenerateExtra(
      { mealId: dinnerMeal.id, kind: "side", mode: "recipe" },
      { complete },
    );
    expect(result.status).toBe(422);
    expect(getCurrentPlan()?.meals[0]?.extras.side?.mode).toBe("suggestion");
    expect(getCurrentPlan()?.meals[0]?.extras.side?.title).toBe("Baked potato");
  });

  it("saves a generated extra recipe to the library and lets you place it", async () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    const { complete: generateComplete } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: [WEEK_DINNERS[0]] }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-09-28", slotMask: mask },
      { complete: generateComplete },
    );
    const dinnerMeal = (generated.body as { plan: WeekPlan }).plan.meals[0]!;
    const potato = {
      title: "Baked potato",
      whyItFits: "Simple starch",
      cookMinutes: 45,
      method: "oven",
      ingredients: [
        { name: "russet potato", quantity: "2", unit: "count", aisle: "produce" },
      ],
      steps: ["Bake at 425°F"],
    };
    const { complete } = fakeComplete([
      { ok: true, text: JSON.stringify(potato) },
    ]);
    const added = await handleGenerateExtra(
      { mealId: dinnerMeal.id, kind: "side", mode: "recipe" },
      { complete },
    );
    expect(added.status).toBe(200);
    const extraId = (added.body as { meal: Meal }).meal.extras.side?.id;
    expect(extraId).toBeTruthy();
    const library = handleListLibrary("side");
    expect(library.status).toBe(200);
    expect(
      (library.body as { meals: { title: string }[] }).meals.map((item) => item.title),
    ).toContain("Baked potato");

    handleDeleteExtra({ mealId: dinnerMeal.id, kind: "side" });
    const placed = handlePlaceExtra({
      sourceMealId: extraId,
      mealId: dinnerMeal.id,
      kind: "side",
    });
    expect(placed.status).toBe(200);
    expect((placed.body as { meal: Meal }).meal.extras.side?.title).toBe(
      "Baked potato",
    );
  });

  it("creates a typed dessert in the library", () => {
    const result = handleCreateMeal({
      title: "Key lime pie",
      cookMinutes: 20,
      method: "no bake",
      slot: "dessert",
      ingredients: [
        { name: "lime juice", quantity: "1/2", unit: "cup", aisle: "produce" },
      ],
      steps: ["Mix", "Chill"],
    });
    expect(result.status).toBe(200);
    expect((result.body as { meal: Meal }).meal.slot).toBe("dessert");
    const library = handleListLibrary("dessert");
    expect(
      (library.body as { meals: { title: string }[] }).meals.map((item) => item.title),
    ).toContain("Key lime pie");
  });

  it("generates library drafts, then approve, rate, and reject", async () => {
    const household = getHousehold();
    expect(household).toBeTruthy();
    const personIds = household!.people.map((person) => person.id);
    const { complete } = fakeComplete([
      {
        ok: true,
        text: JSON.stringify({
          meals: [dinner("monday", "Library draft stew", "beef")],
        }),
      },
    ]);
    const result = await handleGenerateLibrary(
      {
        personIds,
        dinner: { count: 1, diet: "high-protein", avoidances: "pork" },
      },
      { complete },
    );
    expect(result.status).toBe(200);
    const drafts = (result.body as { meals: Meal[] }).meals;
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.draft).toBe(true);
    expect(listAllMeals().some((item) => item.id === drafts[0]!.id)).toBe(false);
    expect(
      (handleListLibrary("dinner").body as { meals: { id: string }[] }).meals.some(
        (item) => item.id === drafts[0]!.id,
      ),
    ).toBe(false);

    const placedDraft = handlePlaceMeal({
      sourceMealId: drafts[0]!.id,
      day: "monday",
      slot: "dinner",
    });
    expect(placedDraft.status).toBe(404);

    const approved = handleApproveDraft({ mealId: drafts[0]!.id });
    expect(approved.status).toBe(200);
    expect((approved.body as { meal: Meal }).meal.draft).toBe(false);
    expect(listAllMeals().some((item) => item.id === drafts[0]!.id)).toBe(true);

    const rated = handleRateMeal({ mealId: drafts[0]!.id, stars: 5 });
    expect(rated.status).toBe(200);
    expect((rated.body as { meal: Meal }).meal.stars).toBe(5);

    const { complete: rejectComplete } = fakeComplete([
      {
        ok: true,
        text: JSON.stringify({
          meals: [dinner("monday", "Reject this stew", "turkey")],
        }),
      },
    ]);
    const second = await handleGenerateLibrary(
      {
        personIds,
        dinner: { count: 1, diet: "high-protein", avoidances: "" },
      },
      { complete: rejectComplete },
    );
    const rejectId = (second.body as { meals: Meal[] }).meals[0]!.id;
    const rejected = handleRejectDraft({ mealId: rejectId });
    expect(rejected.status).toBe(200);
    expect(listDraftMeals().some((item) => item.id === rejectId)).toBe(false);
    expect(listAllMeals().some((item) => item.id === rejectId)).toBe(false);
  });

  it("retries then fails library generate without writing drafts", async () => {
    const before = listDraftMeals().length;
    const household = getHousehold()!;
    const { complete } = fakeComplete([
      { ok: false, error: "timeout" },
      { ok: false, error: "timeout" },
    ]);
    const result = await handleGenerateLibrary(
      {
        personIds: household.people.map((person) => person.id),
        request: {
          slot: "dinner",
          text: "spaghetti sauce",
          diet: "italian",
          avoidances: "",
        },
      },
      { complete },
    );
    expect(result.status).toBe(422);
    expect(listDraftMeals()).toHaveLength(before);
  });
});
