import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import type { GeneratedMeal, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import {
  deleteMeal,
  deletePlan,
  getCurrentPlan,
  listAllMeals,
  listLibraryMeals,
  listPlans,
  mergeGeneratedPlan,
  placeMeal,
  replaceMeal,
  saveGeneratedPlan,
  saveImportedMeal,
  saveStandaloneMeal,
  setMealExtra,
  clearMealExtra,
  placeExtra,
  setPinned,
  setPlanPinned,
  updateMeal,
} from "./repo";
import { EMPTY_EXTRAS, suggestionExtra } from "./extras";

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

  it("persists usedWebSearch on generate and swap", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;

    const plan = saveGeneratedPlan({
      weekStart: "2026-01-19",
      slotMask,
      meals: [meal({ title: "Searched salmon" })],
      usedWebSearch: true,
    });

    expect(plan.meals[0]?.usedWebSearch).toBe(true);
    expect(getCurrentPlan()?.meals[0]?.usedWebSearch).toBe(true);

    const swapped = replaceMeal(plan.id, plan.meals[0]!.id, meal({ title: "Invented tofu" }));
    expect(swapped.usedWebSearch).toBe(false);
    expect(getCurrentPlan()?.meals[0]?.usedWebSearch).toBe(false);
  });

  it("stores a generate sourceUrl and lets swap replace it", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;

    const plan = saveGeneratedPlan({
      weekStart: "2026-01-26",
      slotMask,
      meals: [
        meal({
          title: "Cited salmon",
          sourceUrl: "https://example.com/salmon",
        }),
      ],
      usedWebSearch: true,
    });
    expect(plan.meals[0]?.sourceUrl).toBe("https://example.com/salmon");

    const swapped = replaceMeal(
      plan.id,
      plan.meals[0]!.id,
      meal({
        title: "Cited trout",
        sourceUrl: "https://example.com/trout",
      }),
    );
    expect(swapped.sourceUrl).toBe("https://example.com/trout");
    expect(getCurrentPlan()?.meals[0]?.sourceUrl).toBe(
      "https://example.com/trout",
    );
  });

  it("lists unique library meals for a slot, newest week first", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.monday.lunch = true;

    saveGeneratedPlan({
      weekStart: "2026-01-05",
      slotMask,
      meals: [
        meal({ title: "Library roast chicken" }),
        meal({ day: "monday", slot: "lunch", title: "Library orzo bowl" }),
      ],
    });
    saveGeneratedPlan({
      weekStart: "2026-01-19",
      slotMask,
      meals: [meal({ title: "Library Roast Chicken" })],
    });

    const dinners = listLibraryMeals("dinner");
    const roast = dinners.filter((item) =>
      /library roast chicken/i.test(item.title),
    );
    expect(roast).toHaveLength(1);
    expect(roast[0]?.title).toBe("Library Roast Chicken");
    expect(roast[0]?.weekStart).toBe("2026-01-19");
    expect(
      listLibraryMeals("lunch").some((item) => item.title === "Library orzo bowl"),
    ).toBe(true);
  });

  it("places a library meal onto an empty current square without pinning it", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const sourcePlan = saveGeneratedPlan({
      weekStart: "2026-02-02",
      slotMask,
      meals: [meal({ title: "Crockpot chicken" })],
    });
    const source = sourcePlan.meals[0]!;

    saveGeneratedPlan({
      weekStart: "2026-02-09",
      slotMask,
      meals: [],
    });

    const placed = placeMeal({
      sourceMealId: source.id,
      day: "wednesday",
      slot: "dinner",
      weekStart: "2026-02-09",
    });

    expect(placed.title).toBe("Crockpot chicken");
    expect(placed.day).toBe("wednesday");
    expect(placed.pinned).toBe(false);
    expect(getMealOnCurrent("wednesday", "dinner")?.id).toBe(placed.id);
    expect(sourcePlan.meals[0]?.title).toBe("Crockpot chicken");
  });

  it("replaces a filled square and keeps the previous pin state", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const older = saveGeneratedPlan({
      weekStart: "2026-02-16",
      slotMask,
      meals: [meal({ title: "Sheet-pan trout" })],
    });
    const current = saveGeneratedPlan({
      weekStart: "2026-02-23",
      slotMask,
      meals: [meal({ title: "Monday salmon" })],
    });
    setPinned(current.meals[0]!.id, true);

    const replaced = placeMeal({
      sourceMealId: older.meals[0]!.id,
      day: "monday",
      slot: "dinner",
      weekStart: "2026-02-23",
    });

    expect(replaced.id).toBe(current.meals[0]!.id);
    expect(replaced.title).toBe("Sheet-pan trout");
    expect(replaced.pinned).toBe(true);
    expect(getCurrentPlan()?.meals).toHaveLength(1);
  });

  it("deletePlan removes the week but keeps meals in the library", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-04-06",
      slotMask,
      meals: [meal({ title: "Archive roast" })],
    });

    deletePlan(plan.id);

    expect(listPlans().some((item) => item.id === plan.id)).toBe(false);
    expect(getCurrentPlan()?.id === plan.id).toBe(false);
    expect(
      listLibraryMeals("dinner").some((item) => item.title === "Archive roast"),
    ).toBe(true);
    expect(
      listAllMeals().some((item) => item.title === "Archive roast"),
    ).toBe(true);
  });

  it("deleteMeal removes only that meal from the plan", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-03-16",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Delete me" }),
        meal({ day: "tuesday", title: "Keep me" }),
      ],
    });
    const doomed = plan.meals.find((item) => item.day === "monday")!;
    deleteMeal(doomed.id);

    const reloaded = getCurrentPlan();
    expect(reloaded?.meals.map((item) => item.title)).toEqual(["Keep me"]);
    expect(reloaded?.meals.find((item) => item.id === doomed.id)).toBeUndefined();
  });

  it("saveStandaloneMeal stores a library meal without a source URL", () => {
    const saved = saveStandaloneMeal({
      meal: meal({ title: "Grandma chili", slot: "lunch" }),
      slot: "lunch",
    });
    expect(saved.planId).toBe("");
    expect(saved.slot).toBe("lunch");
    expect(saved.title).toBe("Grandma chili");
    expect(saved.sourceUrl).toBeNull();
    expect(saved.usedWebSearch).toBe(false);
    expect(saved.pinned).toBe(false);
    expect(listAllMeals().some((item) => item.id === saved.id)).toBe(true);
  });

  it("updateMeal changes recipe fields and leaves source and pin alone", () => {
    const saved = saveImportedMeal({
      meal: meal({ title: "Imported stew" }),
      slot: "dinner",
      sourceUrl: "https://example.com/stew",
    });
    const pinned = setPinned(saved.id, true);
    const updated = updateMeal(pinned.id, {
      title: "Edited stew",
      whyItFits: "Still works",
      cookMinutes: 40,
      method: "dutch oven",
      ingredients: [
        { name: "beef", quantity: "1", unit: "lb", aisle: "meat" },
      ],
      steps: ["Simmer"],
    });

    expect(updated.title).toBe("Edited stew");
    expect(updated.ingredients[0]?.name).toBe("beef");
    expect(updated.steps).toEqual(["Simmer"]);
    expect(updated.sourceUrl).toBe("https://example.com/stew");
    expect(updated.pinned).toBe(true);
  });

  it("pin-all and unpin-all flip every meal on the plan", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-03-02",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Salmon" }),
        meal({ day: "tuesday", title: "Chicken" }),
      ],
    });

    const pinned = setPlanPinned(plan.id, true);
    expect(pinned.meals.every((item) => item.pinned)).toBe(true);
    const unpinned = setPlanPinned(plan.id, false);
    expect(unpinned.meals.every((item) => item.pinned)).toBe(false);
  });

  it("mergeGeneratedPlan keeps pinned meals and replaces the rest", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-03-09",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Keep salmon" }),
        meal({ day: "tuesday", title: "Replace chicken" }),
      ],
    });
    setPinned(plan.meals.find((item) => item.day === "monday")!.id, true);

    const merged = mergeGeneratedPlan({
      weekStart: "2026-03-09",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Should not land" }),
        meal({ day: "tuesday", title: "New trout" }),
      ],
    });

    expect(merged.id).toBe(plan.id);
    expect(merged.meals.find((item) => item.day === "monday")?.title).toBe(
      "Keep salmon",
    );
    expect(merged.meals.find((item) => item.day === "tuesday")?.title).toBe(
      "New trout",
    );
    expect(merged.meals.find((item) => item.day === "monday")?.pinned).toBe(
      true,
    );
  });

  it("new meals start with empty extras", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-04-06",
      slotMask,
      meals: [meal({ title: "Salmon" })],
    });
    expect(plan.meals[0]?.extras).toEqual(EMPTY_EXTRAS);
  });

  it("setMealExtra stores a side and clearMealExtra removes it", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-04-13",
      slotMask,
      meals: [meal({ title: "Salmon" })],
    });
    const extra = suggestionExtra({
      id: "extra-1",
      kind: "side",
      title: "Baked potato",
    });
    const withSide = setMealExtra(plan.meals[0]!.id, extra);
    expect(withSide.extras.side).toEqual(extra);
    expect(getCurrentPlan()?.meals[0]?.extras.side?.title).toBe("Baked potato");

    const cleared = clearMealExtra(plan.meals[0]!.id, "side");
    expect(cleared.extras.side).toBeNull();
    expect(getCurrentPlan()?.meals[0]?.extras).toEqual(EMPTY_EXTRAS);
  });

  it("replaceMeal keeps extras on the same row", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-04-20",
      slotMask,
      meals: [meal({ title: "Salmon" })],
    });
    const extra = suggestionExtra({
      id: "extra-keep",
      kind: "dessert",
      title: "Key lime pie",
    });
    setMealExtra(plan.meals[0]!.id, extra);

    const swapped = replaceMeal(
      plan.id,
      plan.meals[0]!.id,
      meal({ title: "Trout" }),
    );
    expect(swapped.title).toBe("Trout");
    expect(swapped.extras.dessert?.title).toBe("Key lime pie");
    expect(getCurrentPlan()?.meals[0]?.extras.dessert?.title).toBe(
      "Key lime pie",
    );
  });

  it("mergeGeneratedPlan drops extras on an unpinned occupant and keeps them on a pinned one", () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-04-27",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Keep salmon" }),
        meal({ day: "tuesday", title: "Replace chicken" }),
      ],
    });
    const monday = plan.meals.find((item) => item.day === "monday")!;
    const tuesday = plan.meals.find((item) => item.day === "tuesday")!;
    setMealExtra(
      monday.id,
      suggestionExtra({ id: "keep-side", kind: "side", title: "Slaw" }),
    );
    setMealExtra(
      tuesday.id,
      suggestionExtra({ id: "drop-side", kind: "side", title: "Fries" }),
    );
    setPinned(monday.id, true);

    const merged = mergeGeneratedPlan({
      weekStart: "2026-04-27",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Should not land" }),
        meal({ day: "tuesday", title: "New trout" }),
      ],
    });

    expect(merged.meals.find((item) => item.day === "monday")?.extras.side?.title).toBe(
      "Slaw",
    );
    expect(merged.meals.find((item) => item.day === "tuesday")?.extras).toEqual(
      EMPTY_EXTRAS,
    );
  });

  it("placeExtra copies a library recipe onto a lunch as a side", () => {
    const slotMask = emptyMask();
    slotMask.monday.lunch = true;
    const plan = saveGeneratedPlan({
      weekStart: "2026-05-11",
      slotMask,
      meals: [meal({ day: "monday", slot: "lunch", title: "Chicken pita" })],
    });
    const source = saveStandaloneMeal({
      meal: meal({ title: "Greek salad", slot: "side" }),
      slot: "side",
    });
    const updated = placeExtra({
      sourceMealId: source.id,
      mealId: plan.meals[0]!.id,
      kind: "side",
    });
    expect(updated.extras.side?.title).toBe("Greek salad");
    expect(updated.extras.side?.mode).toBe("recipe");
    expect(updated.extras.side?.id).toBe(source.id);
  });

  it("placeMeal does not copy extras onto the week", () => {
    const source = saveStandaloneMeal({
      meal: meal({ title: "Library chili" }),
      slot: "dinner",
    });
    setMealExtra(
      source.id,
      suggestionExtra({ id: "lib-side", kind: "side", title: "Cornbread" }),
    );

    const placed = placeMeal({
      sourceMealId: source.id,
      day: "wednesday",
      slot: "dinner",
      weekStart: "2026-05-04",
    });
    expect(placed.title).toBe("Library chili");
    expect(placed.extras).toEqual(EMPTY_EXTRAS);
  });
});

function getMealOnCurrent(day: "wednesday", slot: "dinner") {
  return getCurrentPlan()?.meals.find(
    (item) => item.day === day && item.slot === slot,
  );
}
