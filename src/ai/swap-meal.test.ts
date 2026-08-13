import { describe, expect, it } from "vitest";
import { swapMeal } from "./swap-meal";
import type {
  AdapterRequest,
  AdapterResult,
  AiTrace,
  GeneratedMeal,
  Household,
  KitchenItem,
  SlotMask,
} from "@/lib/types";
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
  notes: "",
  servings: 1,
  people: [
    {
      id: "p1",
      name: "Alex",
      age: 40,
      sex: "male",
      allergies: ["shrimp"],
      avoidances: [],
    },
  ],
};

const kitchen: KitchenItem[] = [];

const current: GeneratedMeal = {
  day: "monday",
  slot: "dinner",
  title: "Lemon herb salmon",
  whyItFits: "High-protein Mediterranean, sheet pan",
  cookMinutes: 35,
  method: "sheet pan",
  ingredients: [
    { name: "salmon fillets", quantity: 2, unit: "count", aisle: "meat" },
  ],
  steps: ["Heat oven to 425°F", "Roast 15 minutes"],
};

const otherMeals: GeneratedMeal[] = [
  {
    day: "tuesday",
    slot: "dinner",
    title: "Crockpot chicken",
    whyItFits: "Hands-off protein",
    cookMinutes: 240,
    method: "crockpot",
    ingredients: [
      { name: "chicken thighs", quantity: 2, unit: "lb", aisle: "meat" },
    ],
    steps: ["Add to crockpot", "Cook on low"],
  },
];

const trout: GeneratedMeal = {
  ...current,
  title: "Sheet-pan trout",
  ingredients: [{ name: "trout", quantity: 2, unit: "count", aisle: "meat" }],
};

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

function mealText(meal: GeneratedMeal): string {
  return JSON.stringify({ meal });
}

function mondayDinnerMask(): SlotMask {
  const slotMask = emptyMask();
  slotMask.monday.dinner = true;
  return slotMask;
}

describe("swapMeal", () => {
  it("returns a different meal when the model suggests a new title", async () => {
    const adapter = fakeAdapter([{ ok: true, text: mealText(trout) }]);
    const traces: Omit<AiTrace, "id" | "createdAt">[] = [];

    const result = await swapMeal({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      current,
      otherMeals,
      adapter,
      logTrace: (t) => traces.push(t),
      settings,
    });

    expect(result).toEqual({ ok: true, meal: trout });
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ kind: "swap", validation: "ok" });
  });

  it("fails when the retry is still a duplicate of current or other meals", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: mealText({ ...current, title: "lemon-herb salmon" }) },
      { ok: true, text: mealText({ ...current, title: "Crockpot chicken" }) },
    ]);

    const result = await swapMeal({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      current,
      otherMeals,
      adapter,
      logTrace: () => {},
      settings,
    });

    expect(result).toEqual({
      ok: false,
      message: "Couldn’t find a different meal, try again.",
    });
  });

  it("asks the model not to repeat the current and other meal titles", async () => {
    const adapter = fakeAdapter([{ ok: true, text: mealText(trout) }]);

    await swapMeal({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      current,
      otherMeals,
      adapter,
      logTrace: () => {},
      settings,
    });

    expect(adapter.requests[0].schemaName).toBe("single_meal");
    const user = adapter.requests[0].messages[1].content.toLowerCase();
    expect(user).toContain("monday dinner");
    expect(user).toContain("lemon herb salmon");
    expect(user).toContain("crockpot chicken");
  });
});
