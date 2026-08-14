import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import type { GeneratedMeal, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { getCurrentPlan, listPlans, replaceMeal, saveGeneratedPlan } from "./repo";

const dbPath = path.join(os.tmpdir(), `mortang-meals-${crypto.randomUUID()}.db`);

beforeAll(() => {
  process.env.MORTANG_DB_PATH = dbPath;
  resetDbForTests();
});

afterAll(() => {
  resetDbForTests();
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
});

function emptyMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((d) => [d, Object.fromEntries(SLOTS.map((s) => [s, false]))]),
  ) as SlotMask;
}

function meal(overrides: Partial<GeneratedMeal> = {}): GeneratedMeal {
  return {
    day: "monday",
    slot: "dinner",
    title: "Lemon herb salmon",
    whyItFits: "High-protein Mediterranean",
    cookMinutes: 35,
    method: "sheet pan",
    ingredients: [{ name: "salmon", quantity: "2", unit: "count", aisle: "meat" }],
    steps: ["Roast"],
    ...overrides,
  };
}

describe("meals repo", () => {
  it("saveGeneratedPlan twice for the same weekStart keeps both, newest current", () => {
    const weekStart = "2026-01-05";
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;

    const first = saveGeneratedPlan({
      weekStart,
      slotMask,
      meals: [meal({ title: "First salmon" })],
    });
    const second = saveGeneratedPlan({
      weekStart,
      slotMask,
      meals: [meal({ title: "Second salmon" })],
    });

    expect(second.isCurrent).toBe(true);

    const plans = listPlans();
    expect(plans).toHaveLength(2);
    const byId = Object.fromEntries(plans.map((plan) => [plan.id, plan]));
    expect(byId[first.id]?.isCurrent).toBe(false);
    expect(byId[second.id]?.isCurrent).toBe(true);

    const current = getCurrentPlan();
    expect(current?.id).toBe(second.id);
    expect(current?.meals.map((item) => item.title)).toEqual(["Second salmon"]);
  });

  it("replaceMeal changes only that meal's title", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;

    const plan = saveGeneratedPlan({
      weekStart: "2026-01-12",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Monday salmon" }),
        meal({ day: "tuesday", title: "Tuesday chicken" }),
      ],
    });

    const monday = plan.meals.find((item) => item.day === "monday");
    const tuesday = plan.meals.find((item) => item.day === "tuesday");
    expect(monday).toBeDefined();
    expect(tuesday).toBeDefined();

    const updated = replaceMeal(plan.id, monday!.id, {
      ...monday!,
      title: "Monday tofu",
    });

    expect(updated.title).toBe("Monday tofu");

    const reloaded = getCurrentPlan();
    expect(reloaded?.meals.find((item) => item.id === monday!.id)?.title).toBe(
      "Monday tofu",
    );
    expect(reloaded?.meals.find((item) => item.id === tuesday!.id)?.title).toBe(
      "Tuesday chicken",
    );
  });
});
