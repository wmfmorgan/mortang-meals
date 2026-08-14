import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateWeekPlan } from "./generate-plan";
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

const validMondayDinner: GeneratedMeal = {
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

function mealsText(meals: GeneratedMeal[]): string {
  return JSON.stringify({ meals });
}

function mondayDinnerMask(): SlotMask {
  const slotMask = emptyMask();
  slotMask.monday.dinner = true;
  return slotMask;
}

function tracesOf(log: Omit<AiTrace, "id" | "createdAt">[]) {
  return log.map((t) => ({ kind: t.kind, validation: t.validation }));
}

describe("generateWeekPlan", () => {
  it("returns the meals and logs generate/ok on the first valid response", async () => {
    const adapter = fakeAdapter([{ ok: true, text: mealsText([validMondayDinner]) }]);
    const traces: Omit<AiTrace, "id" | "createdAt">[] = [];

    const result = await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: (t) => traces.push(t),
      settings,
    });

    expect(result).toEqual({ ok: true, meals: [validMondayDinner] });
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ kind: "generate", validation: "ok" });
  });

  it("retries after invalid JSON and succeeds on the second response", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: "not-json" },
      { ok: true, text: mealsText([validMondayDinner]) },
    ]);
    const traces: Omit<AiTrace, "id" | "createdAt">[] = [];

    const result = await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: (t) => traces.push(t),
      settings,
    });

    expect(result).toEqual({ ok: true, meals: [validMondayDinner] });
    expect(tracesOf(traces)).toEqual([
      { kind: "generate", validation: "invalid-json" },
      { kind: "generate-retry", validation: "ok" },
    ]);
  });

  it("fails after a repeated allergen leak and does not persist", async () => {
    const shrimpMeal: GeneratedMeal = {
      ...validMondayDinner,
      title: "Garlic shrimp",
      ingredients: [{ name: "shrimp", quantity: "1", unit: "lb", aisle: "meat" }],
    };
    const adapter = fakeAdapter([
      { ok: true, text: mealsText([shrimpMeal]) },
      { ok: true, text: mealsText([shrimpMeal]) },
    ]);
    const traces: Omit<AiTrace, "id" | "createdAt">[] = [];

    const result = await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: (t) => traces.push(t),
      settings,
    });

    expect(result).toEqual({
      ok: false,
      message: "Couldn’t get a usable plan, try again.",
    });
    expect(tracesOf(traces)).toEqual([
      { kind: "generate", validation: "allergen" },
      { kind: "generate-retry", validation: "allergen" },
    ]);

    const src = readFileSync(
      fileURLToPath(new URL("./generate-plan.ts", import.meta.url)),
      "utf8",
    );
    expect(src).not.toMatch(/saveGeneratedPlan/);
  });

  it("treats two meals on the same requested slot as schema and retries", async () => {
    const extraOnSameSlot: GeneratedMeal = {
      ...validMondayDinner,
      title: "Garlic roast chicken",
    };
    const adapter = fakeAdapter([
      { ok: true, text: mealsText([validMondayDinner, extraOnSameSlot]) },
      { ok: true, text: mealsText([validMondayDinner]) },
    ]);
    const traces: Omit<AiTrace, "id" | "createdAt">[] = [];

    const result = await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: (t) => traces.push(t),
      settings,
    });

    expect(result).toEqual({ ok: true, meals: [validMondayDinner] });
    expect(tracesOf(traces)).toEqual([
      { kind: "generate", validation: "schema" },
      { kind: "generate-retry", validation: "ok" },
    ]);
    expect(adapter.requests).toHaveLength(2);
  });

  it("logs duplicate and retries once when two meals share a title", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const dupA: GeneratedMeal = { ...validMondayDinner, title: "Herb chicken" };
    const dupB: GeneratedMeal = {
      ...validMondayDinner,
      day: "tuesday",
      title: "Herb chicken",
    };
    const okB: GeneratedMeal = {
      ...validMondayDinner,
      day: "tuesday",
      title: "Sheet-pan trout",
    };
    const adapter = fakeAdapter([
      { ok: true, text: mealsText([dupA, dupB]) },
      { ok: true, text: mealsText([dupA, okB]) },
    ]);
    const traces: Omit<AiTrace, "id" | "createdAt">[] = [];

    const result = await generateWeekPlan({
      household,
      kitchen,
      slotMask,
      adapter,
      logTrace: (t) => traces.push(t),
      settings,
    });

    expect(result).toEqual({ ok: true, meals: [dupA, okB] });
    expect(traces[0]).toMatchObject({
      kind: "generate",
      validation: "duplicate",
    });
    expect(adapter.requests).toHaveLength(2);
  });

  it("returns the transport message when the adapter fails twice", async () => {
    const adapter = fakeAdapter([
      { ok: false, error: "timeout" },
      { ok: false, error: "timeout" },
    ]);

    const result = await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: () => {},
      settings,
    });

    expect(result).toEqual({
      ok: false,
      message: "The model didn’t respond",
    });
  });

  it("sends the household brief and requested slots in the first request", async () => {
    const adapter = fakeAdapter([{ ok: true, text: mealsText([validMondayDinner]) }]);

    await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: () => {},
      settings,
    });

    expect(adapter.requests[0].schemaName).toBe("week_plan");
    expect(adapter.requests[0].messages[0].content).toContain(
      "high-protein Mediterranean",
    );
    expect(adapter.requests[0].messages[1].content).toContain("monday dinner");
  });

  it("stops immediately when the abort signal is already aborted", async () => {
    const adapter = fakeAdapter([{ ok: true, text: mealsText([validMondayDinner]) }]);
    const signal = AbortSignal.abort();

    const result = await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: () => {},
      settings,
      signal,
    });

    expect(result).toEqual({ ok: false, message: "Generate cancelled." });
    expect(adapter.requests).toHaveLength(0);
  });

  it("reports brief, calling, and validating progress on a clean generate", async () => {
    const adapter = fakeAdapter([{ ok: true, text: mealsText([validMondayDinner]) }]);
    const phases: string[] = [];

    await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: () => {},
      settings,
      onProgress: (event) => phases.push(event.phase),
    });

    expect(phases).toEqual(["brief", "calling", "validating"]);
  });

  it("asks the model to use web_search when the setting is on", async () => {
    const adapter = fakeAdapter([{ ok: true, text: mealsText([validMondayDinner]) }]);

    await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: () => {},
      settings: { ...settings, webSearch: true },
    });

    expect(adapter.requests[0]?.messages[0]?.content).toMatch(/Use web_search/);
  });

  it("reports a retry phase after invalid JSON", async () => {
    const adapter = fakeAdapter([
      { ok: true, text: "not-json" },
      { ok: true, text: mealsText([validMondayDinner]) },
    ]);
    const phases: string[] = [];

    await generateWeekPlan({
      household,
      kitchen,
      slotMask: mondayDinnerMask(),
      adapter,
      logTrace: () => {},
      settings,
      onProgress: (event) => phases.push(event.phase),
    });

    expect(phases).toEqual([
      "brief",
      "calling",
      "validating",
      "retry",
      "calling",
      "validating",
    ]);
  });
});
