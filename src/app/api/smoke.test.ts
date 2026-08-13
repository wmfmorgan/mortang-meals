import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleGenerate, handleSwap } from "@/ai/http";
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
import { getCurrentPlan } from "@/meals/repo";
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
    ingredients: [{ name: protein, quantity: 1, unit: "lb", aisle: "meat" }],
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
      ingredients: [{ name: "trout", quantity: 1, unit: "lb", aisle: "meat" }],
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
});
