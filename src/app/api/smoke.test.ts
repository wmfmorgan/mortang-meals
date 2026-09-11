import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { saveSettings } from "@/ai/settings-repo";
import { AI_DAILY_CAP } from "@/ai/usage";
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
import {
  getHouseholdForUser,
  replacePeople,
  upsertHousehold,
} from "@/household/repo";
import { seedKitchenIfEmpty } from "@/kitchen/repo";
import { getDb, resetDbForTests } from "@/lib/db";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
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

let ident: Awaited<ReturnType<typeof createTestIdentity>>;
const extraUsers: string[] = [];
let previousXaiKey: string | undefined;

function authOf(identity: { userId: string; householdId: string }) {
  return { userId: identity.userId, householdId: identity.householdId };
}

function deps(extra: {
  complete?: (req: AdapterRequest) => Promise<AdapterResult>;
} = {}) {
  return { auth: authOf(ident), ...extra };
}

beforeAll(async () => {
  previousXaiKey = process.env.XAI_API_KEY;
  process.env.XAI_API_KEY = "test-key";
  await resetDbForTests();

  ident = await createTestIdentity();
  await upsertHousehold({
    ownerId: ident.userId,
    id: ident.householdId,
    name: "Mortang",
    dietStyle: "high-protein Mediterranean",
    notes: "",
    servings: 2,
  });
  await replacePeople(ident.householdId, [
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
  await seedKitchenIfEmpty(ident.householdId);
});

afterAll(async () => {
  await resetDbForTests();
  await deleteTestUser(ident.userId);
  await Promise.all(extraUsers.splice(0).map(deleteTestUser));
  if (previousXaiKey === undefined) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = previousXaiKey;
});

beforeEach(async () => {
  await getDb().execute(sql`truncate table public.ai_usage`);
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

function allDinners(): SlotMask {
  return weekdayDinnerMask();
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
  it("generate without auth is 401", async () => {
    const result = await handleGenerate(
      { slotMask: allDinners() },
      { complete: async () => ({ ok: true, text: "{}" }) },
    );
    expect(result.status).toBe(401);
  });

  it("user B cannot list user A's library", async () => {
    const a = authOf(ident);
    const other = await createTestIdentity();
    extraUsers.push(other.userId);
    const b = authOf(other);
    await handleCreateMeal(
      {
        slot: "dinner",
        title: "A only",
        whyItFits: "x",
        cookMinutes: 20,
        method: "pot",
        ingredients: [{ name: "beans", quantity: "1", unit: "can", aisle: "pantry" }],
        steps: ["Cook"],
      },
      { auth: a },
    );
    const listed = await handleListLibrary("dinner", { auth: b });
    expect((listed.body as { meals: { title: string }[] }).meals).toEqual([]);
  });

  it("generates seven weekday dinners and persists the current plan", async () => {
    const { complete } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: WEEK_DINNERS }) },
    ]);

    const result = await handleGenerate(
      { weekStart: "2026-08-10", slotMask: weekdayDinnerMask() },
      deps({ complete }),
    );

    expect(result.status).toBe(200);
    const body = result.body as { plan: WeekPlan };
    expect(body.plan.meals).toHaveLength(7);
    expect(await getCurrentPlan(ident.householdId)).toEqual(body.plan);
  });

  it("swaps Monday dinner and returns the shopping list the client would show", async () => {
    const { complete: generateComplete } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: WEEK_DINNERS }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-08-10", slotMask: weekdayDinnerMask() },
      deps({ complete: generateComplete }),
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
      deps({ complete }),
    );

    expect(result.status).toBe(200);
    const body = result.body as { meal: Meal; shoppingList: ShoppingList };
    expect(body.meal.title).toBe("Sheet-pan trout");

    const current = await getCurrentPlan(ident.householdId);
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
    const existing = await getCurrentPlan(ident.householdId);
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
      deps({ complete }),
    );

    expect(result.status).toBe(200);
    expect((result.body as { meal: Meal }).meal.title).toBe("Grilled trout");
    expect(requests[0]!.messages[1]!.content.toLowerCase()).toContain(
      "made on the grill",
    );
    expect(
      (await getCurrentPlan(ident.householdId))
        ?.meals.filter((meal) => meal.day !== "monday")
        .map((meal) => meal.title),
    ).toEqual(otherTitles);
  });

  it("marks generated meals as usedWebSearch when the Grok toggle is on", async () => {
    await saveSettings(ident.householdId, { webSearch: true });
    try {
      const { complete } = fakeComplete([
        { ok: true, text: JSON.stringify({ meals: WEEK_DINNERS }) },
      ]);
      const result = await handleGenerate(
        { weekStart: "2026-08-17", slotMask: weekdayDinnerMask() },
        deps({ complete }),
      );
      expect(result.status).toBe(200);
      const meals = (result.body as { plan: WeekPlan }).plan.meals;
      expect(meals.every((meal) => meal.usedWebSearch)).toBe(true);
    } finally {
      await saveSettings(ident.householdId, { webSearch: false });
    }
  });

  it("keeps a pinned dinner and only asks the model for the remaining slots", async () => {
    const { complete: first } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: WEEK_DINNERS }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-08-24", slotMask: weekdayDinnerMask() },
      deps({ complete: first }),
    );
    const plan = (generated.body as { plan: WeekPlan }).plan;
    const monday = plan.meals.find((meal) => meal.day === "monday")!;
    await setPinned(ident.householdId, monday.id, true);

    const rest = WEEK_DINNERS.filter((meal) => meal.day !== "monday").map(
      (meal) => ({ ...meal, title: `New ${meal.title}` }),
    );
    const { complete, requests } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: rest }) },
    ]);
    const result = await handleGenerate(
      { weekStart: "2026-08-24", slotMask: weekdayDinnerMask() },
      deps({ complete }),
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
    const existing = await getCurrentPlan(ident.householdId);
    if (existing) await setPlanPinned(ident.householdId, existing.id, false);

    const mask = emptyMask();
    mask.monday.dinner = true;
    const { complete: first } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: [WEEK_DINNERS[0]] }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-08-31", slotMask: mask },
      deps({ complete: first }),
    );
    const meal = (generated.body as { plan: WeekPlan }).plan.meals[0]!;
    await setPinned(ident.householdId, meal.id, true);

    let called = false;
    const result = await handleGenerate(
      { weekStart: "2026-08-31", slotMask: mask },
      deps({
        complete: async () => {
          called = true;
          return { ok: true, text: "{}" };
        },
      }),
    );

    expect(result.status).toBe(400);
    expect((result.body as { message: string }).message).toMatch(/pinned/i);
    expect(called).toBe(false);
  });

  it("rejects generate with an empty diet style without calling the adapter", async () => {
    const household = await getHouseholdForUser(ident.userId);
    expect(household).not.toBeNull();
    await upsertHousehold({
      ownerId: ident.userId,
      id: household!.id,
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
        deps({ complete }),
      );

      expect(result.status).toBe(400);
      expect((result.body as { message: string }).message).toMatch(/diet style/i);
      expect(called).toBe(false);
    } finally {
      await upsertHousehold({
        ownerId: ident.userId,
        id: household!.id,
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
      deps({ complete: generateComplete }),
    );
    const lunch = (generated.body as { plan: WeekPlan }).plan.meals[0]!;

    const { complete } = fakeComplete([
      { ok: true, text: JSON.stringify({ title: "Baked potato" }) },
    ]);
    const added = await handleGenerateExtra(
      { mealId: lunch.id, kind: "side", mode: "suggestion" },
      deps({ complete }),
    );
    expect(added.status).toBe(200);
    const withSide = (added.body as { meal: Meal }).meal;
    expect(withSide.extras.side?.title).toBe("Baked potato");
    expect(withSide.extras.side?.mode).toBe("suggestion");

    const deleted = await handleDeleteExtra(
      { mealId: lunch.id, kind: "side" },
      deps({}),
    );
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
      deps({ complete: breakfastComplete }),
    );
    const breakfast = (breakfastPlan.body as { plan: WeekPlan }).plan.meals[0]!;
    const breakfastResult = await handleGenerateExtra(
      { mealId: breakfast.id, kind: "side", mode: "suggestion" },
      deps({
        complete: async () => ({
          ok: true,
          text: JSON.stringify({ title: "Toast" }),
        }),
      }),
    );
    expect(breakfastResult.status).toBe(400);
    expect((breakfastResult.body as { message: string }).message).toMatch(
      /breakfast/i,
    );

    const historical = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-01-05",
      slotMask: weekdayDinnerMask(),
      meals: [dinner("monday", "Old salmon", "salmon")],
    });
    await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-01-12",
      slotMask: weekdayDinnerMask(),
      meals: [dinner("monday", "New trout", "trout")],
    });
    const oldMeal = historical.meals[0]!;
    const historicalResult = await handleGenerateExtra(
      { mealId: oldMeal.id, kind: "dessert", mode: "suggestion" },
      deps({
        complete: async () => ({
          ok: true,
          text: JSON.stringify({ title: "Pie" }),
        }),
      }),
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
      deps({ complete: generateComplete }),
    );
    const dinnerMeal = (generated.body as { plan: WeekPlan }).plan.meals[0]!;
    await setMealExtra(
      ident.householdId,
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
      deps({ complete }),
    );
    expect(result.status).toBe(422);
    expect(
      (await getCurrentPlan(ident.householdId))?.meals[0]?.extras.side?.mode,
    ).toBe("suggestion");
    expect(
      (await getCurrentPlan(ident.householdId))?.meals[0]?.extras.side?.title,
    ).toBe("Baked potato");
  });

  it("saves a generated extra recipe to the library and lets you place it", async () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    const { complete: generateComplete } = fakeComplete([
      { ok: true, text: JSON.stringify({ meals: [WEEK_DINNERS[0]] }) },
    ]);
    const generated = await handleGenerate(
      { weekStart: "2026-09-28", slotMask: mask },
      deps({ complete: generateComplete }),
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
      deps({ complete }),
    );
    expect(added.status).toBe(200);
    const extraId = (added.body as { meal: Meal }).meal.extras.side?.id;
    expect(extraId).toBeTruthy();
    const library = await handleListLibrary("side", deps({}));
    expect(library.status).toBe(200);
    expect(
      (library.body as { meals: { title: string }[] }).meals.map((item) => item.title),
    ).toContain("Baked potato");

    await handleDeleteExtra({ mealId: dinnerMeal.id, kind: "side" }, deps({}));
    const placed = await handlePlaceExtra(
      {
        sourceMealId: extraId,
        mealId: dinnerMeal.id,
        kind: "side",
      },
      deps({}),
    );
    expect(placed.status).toBe(200);
    expect((placed.body as { meal: Meal }).meal.extras.side?.title).toBe(
      "Baked potato",
    );
  });

  it("creates a typed dessert in the library", async () => {
    const result = await handleCreateMeal(
      {
        title: "Key lime pie",
        cookMinutes: 20,
        method: "no bake",
        slot: "dessert",
        ingredients: [
          { name: "lime juice", quantity: "1/2", unit: "cup", aisle: "produce" },
        ],
        steps: ["Mix", "Chill"],
      },
      deps({}),
    );
    expect(result.status).toBe(200);
    expect((result.body as { meal: Meal }).meal.slot).toBe("dessert");
    const library = await handleListLibrary("dessert", deps({}));
    expect(
      (library.body as { meals: { title: string }[] }).meals.map((item) => item.title),
    ).toContain("Key lime pie");
  });

  it("generates library drafts, then approve, rate, and reject", async () => {
    const household = await getHouseholdForUser(ident.userId);
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
      deps({ complete }),
    );
    expect(result.status).toBe(200);
    const drafts = (result.body as { meals: Meal[] }).meals;
    expect(drafts).toHaveLength(1);
    expect(drafts[0]!.draft).toBe(true);
    expect(
      (await listAllMeals(ident.householdId)).some((item) => item.id === drafts[0]!.id),
    ).toBe(false);
    expect(
      (
        (await handleListLibrary("dinner", deps({}))).body as {
          meals: { id: string }[];
        }
      ).meals.some((item) => item.id === drafts[0]!.id),
    ).toBe(false);

    const placedDraft = await handlePlaceMeal(
      {
        sourceMealId: drafts[0]!.id,
        day: "monday",
        slot: "dinner",
      },
      deps({}),
    );
    expect(placedDraft.status).toBe(404);

    const approved = await handleApproveDraft(
      { mealId: drafts[0]!.id },
      deps({}),
    );
    expect(approved.status).toBe(200);
    expect((approved.body as { meal: Meal }).meal.draft).toBe(false);
    expect(
      (await listAllMeals(ident.householdId)).some((item) => item.id === drafts[0]!.id),
    ).toBe(true);

    const rated = await handleRateMeal(
      { mealId: drafts[0]!.id, stars: 5 },
      deps({}),
    );
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
      deps({ complete: rejectComplete }),
    );
    const rejectId = (second.body as { meals: Meal[] }).meals[0]!.id;
    const rejected = await handleRejectDraft({ mealId: rejectId }, deps({}));
    expect(rejected.status).toBe(200);
    expect(
      (await listDraftMeals(ident.householdId)).some((item) => item.id === rejectId),
    ).toBe(false);
    expect(
      (await listAllMeals(ident.householdId)).some((item) => item.id === rejectId),
    ).toBe(false);
  });

  it("retries then fails library generate without writing drafts", async () => {
    const before = (await listDraftMeals(ident.householdId)).length;
    const household = (await getHouseholdForUser(ident.userId))!;
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
      deps({ complete }),
    );
    expect(result.status).toBe(422);
    expect(await listDraftMeals(ident.householdId)).toHaveLength(before);
  });

  it("caps shared-key generate at AI_DAILY_CAP then 429s without changing the plan", async () => {
    const { complete, requests } = fakeComplete(
      Array.from({ length: AI_DAILY_CAP + 1 }, () => ({
        ok: true as const,
        text: JSON.stringify({ meals: WEEK_DINNERS }),
      })),
    );

    let last: Awaited<ReturnType<typeof handleGenerate>> | undefined;
    for (let i = 0; i < AI_DAILY_CAP; i++) {
      last = await handleGenerate(
        { weekStart: "2026-08-10", slotMask: weekdayDinnerMask() },
        deps({ complete }),
      );
      expect(last.status).toBe(200);
    }
    const afterTenth = await getCurrentPlan(ident.householdId);
    expect(afterTenth).toEqual((last!.body as { plan: WeekPlan }).plan);

    const eleventh = await handleGenerate(
      { weekStart: "2026-08-10", slotMask: weekdayDinnerMask() },
      deps({ complete }),
    );
    expect(eleventh.status).toBe(429);
    expect((eleventh.body as { message: string }).message).toBe(
      "Daily generate limit reached. Try again tomorrow.",
    );
    expect(await getCurrentPlan(ident.householdId)).toEqual(afterTenth);
    expect(requests).toHaveLength(AI_DAILY_CAP);
  });
});
