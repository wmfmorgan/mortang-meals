import { describe, expect, it } from "vitest";
import { generateExtra } from "./generate-extra";
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

const parent: GeneratedMeal = {
  day: "monday",
  slot: "dinner",
  title: "Lemon herb salmon",
  whyItFits: "High-protein Mediterranean, sheet pan",
  cookMinutes: 35,
  method: "sheet pan",
  ingredients: [
    { name: "salmon fillets", quantity: "2", unit: "count", aisle: "meat" },
  ],
  steps: ["Heat oven to 425°F", "Roast 15 minutes"],
};

const potatoRecipe = {
  title: "Baked potato",
  whyItFits: "Simple starch",
  cookMinutes: 45,
  method: "oven",
  ingredients: [
    { name: "russet potato", quantity: "2", unit: "count", aisle: "produce" },
  ],
  steps: ["Bake at 425°F"],
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

function mondayDinnerMask(): SlotMask {
  const slotMask = emptyMask();
  slotMask.monday.dinner = true;
  return slotMask;
}

describe("generateExtra", () => {
  it("returns a suggestion title", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ title: "Baked potato" }) },
    ]);
    const traces: Omit<AiTrace, "id" | "createdAt">[] = [];

    const result = await generateExtra({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      parent,
      kind: "side",
      mode: "suggestion",
      reservedTitles: [],
      adapter,
      logTrace: (t) => traces.push(t),
      settings,
    });

    expect(result).toEqual({
      ok: true,
      extra: {
        mode: "suggestion",
        title: "Baked potato",
        whyItFits: "",
        cookMinutes: 0,
        method: "",
        ingredients: [],
        steps: [],
        usedWebSearch: false,
        sourceUrl: null,
      },
    });
    expect(traces[0]).toMatchObject({ kind: "extra", validation: "ok" });
    expect(adapter.requests[0]?.schemaName).toBe("extra_suggestion");
  });

  it("returns a full extra recipe", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify(potatoRecipe) },
    ]);

    const result = await generateExtra({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      parent,
      kind: "side",
      mode: "recipe",
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extra.mode).toBe("recipe");
      expect(result.extra.title).toBe("Baked potato");
      expect(result.extra.ingredients).toEqual(potatoRecipe.ingredients);
      expect(result.extra.steps).toEqual(potatoRecipe.steps);
    }
    expect(adapter.requests[0]?.schemaName).toBe("extra_recipe");
  });

  it("retries then fails on an allergen in a recipe extra", async () => {
    const shrimpy = {
      ...potatoRecipe,
      title: "Shrimp cocktail",
      ingredients: [
        { name: "shrimp", quantity: "1", unit: "lb", aisle: "meat" },
      ],
    };
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify(shrimpy) },
      { ok: true, text: JSON.stringify(shrimpy) },
    ]);
    const traces: Omit<AiTrace, "id" | "createdAt">[] = [];

    const result = await generateExtra({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      parent,
      kind: "side",
      mode: "recipe",
      reservedTitles: [],
      adapter,
      logTrace: (t) => traces.push(t),
      settings,
    });

    expect(result).toEqual({
      ok: false,
      message: "Couldn’t add that extra, try again.",
    });
    expect(traces.map((t) => t.kind)).toEqual(["extra", "extra-retry"]);
    expect(traces.every((t) => t.validation === "allergen")).toBe(true);
  });

  it("retries a suggestion that duplicates the parent title", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ title: "Lemon herb salmon" }) },
      { ok: true, text: JSON.stringify({ title: "Baked potato" }) },
    ]);

    const result = await generateExtra({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      parent,
      kind: "side",
      mode: "suggestion",
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.extra.title).toBe("Baked potato");
    expect(adapter.requests).toHaveLength(2);
  });

  it("keeps the requested title when upgrading a suggestion to a recipe", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: JSON.stringify({ ...potatoRecipe, title: "Roasted yams" }) },
    ]);

    const result = await generateExtra({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      parent,
      kind: "side",
      mode: "recipe",
      keepTitle: "Baked potato",
      reservedTitles: [],
      adapter,
      logTrace: () => {},
      settings,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.extra.title).toBe("Baked potato");
    expect(adapter.requests[0]?.messages[1]?.content).toMatch(/baked potato/i);
  });
});
