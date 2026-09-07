import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { meals as mealsTable } from "@/lib/schema";
import type { GeneratedMeal, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import {
  deleteMeal,
  deletePlan,
  getCurrentPlan,
  getPlan,
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
  listDraftMeals,
  listCatalogMeals,
  approveDraft,
  rejectDraft,
  setMealStars,
  openPlan,
  resolveOpenPlan,
  saveTakeoutMeal,
  saveLeftoverMeal,
  fillEmptySlots,
  dedupeLibraryMeals,
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

  it("keeps drafts out of the library until they are approved", () => {
    const draft = saveStandaloneMeal({
      meal: meal({ title: "Draft chili", slot: "dinner" }),
      slot: "dinner",
      draft: true,
    });
    expect(listAllMeals().some((item) => item.id === draft.id)).toBe(false);
    expect(listDraftMeals().some((item) => item.id === draft.id)).toBe(true);
    expect(listLibraryMeals("dinner").some((item) => item.id === draft.id)).toBe(
      false,
    );

    const saved = approveDraft(draft.id);
    expect(saved.draft).toBe(false);
    expect(listAllMeals().some((item) => item.id === draft.id)).toBe(true);
    expect(listDraftMeals()).toHaveLength(0);
  });

  it("deletes a rejected draft", () => {
    const draft = saveStandaloneMeal({
      meal: meal({ title: "Reject me", slot: "lunch" }),
      slot: "lunch",
      draft: true,
    });
    rejectDraft(draft.id);
    expect(listDraftMeals().some((item) => item.id === draft.id)).toBe(false);
    expect(listAllMeals().some((item) => item.id === draft.id)).toBe(false);
  });

  it("rates a saved meal and refuses a draft", () => {
    const saved = saveStandaloneMeal({
      meal: meal({ title: "Rated stew", slot: "dinner" }),
      slot: "dinner",
    });
    expect(setMealStars(saved.id, 4).stars).toBe(4);
    const draft = saveStandaloneMeal({
      meal: meal({ title: "Unrated draft", slot: "dinner" }),
      slot: "dinner",
      draft: true,
    });
    expect(() => setMealStars(draft.id, 5)).toThrow(/draft/i);
  });

  it("opens another week without deleting this week", () => {
    const first = saveGeneratedPlan({
      weekStart: "2026-06-01",
      slotMask: emptyMask(),
      meals: [meal({ title: "June chili" })],
    });
    const next = openPlan("2026-06-08");
    expect(next.weekStart).toBe("2026-06-08");
    expect(next.isCurrent).toBe(true);
    expect(getPlan(first.id)?.meals.some((item) => item.title === "June chili")).toBe(
      true,
    );
    const back = openPlan("2026-06-01");
    expect(back.id).toBe(first.id);
    expect(back.meals.some((item) => item.title === "June chili")).toBe(true);
  });

  it("opens this calendar week when the current plan is in the past", () => {
    const past = openPlan("2026-08-24");
    const opened = resolveOpenPlan(undefined, new Date(2026, 8, 6));
    expect(opened.weekStart).toBe("2026-08-31");
    expect(opened.isCurrent).toBe(true);
    expect(getPlan(past.id)?.isCurrent).toBe(false);
  });

  it("keeps a future current plan instead of snapping back", () => {
    const next = openPlan("2026-09-07");
    const opened = resolveOpenPlan(undefined, new Date(2026, 8, 6));
    expect(opened.id).toBe(next.id);
    expect(opened.weekStart).toBe("2026-09-07");
  });

  it("saves takeout without ingredients", () => {
    const mealRow = saveTakeoutMeal({
      day: "friday",
      slot: "dinner",
      title: "Thai Palace",
      weekStart: "2026-06-15",
    });
    expect(mealRow.takeout).toBe(true);
    expect(mealRow.ingredients).toEqual([]);
    expect(listLibraryMeals("dinner").some((item) => item.id === mealRow.id)).toBe(
      false,
    );
  });

  it("copies leftovers onto another cell", () => {
    const plan = saveGeneratedPlan({
      weekStart: "2026-06-22",
      slotMask: emptyMask(),
      meals: [meal({ title: "Chili", day: "monday", slot: "dinner" })],
    });
    const source = plan.meals[0]!;
    const leftover = saveLeftoverMeal({
      sourceMealId: source.id,
      day: "tuesday",
      slot: "lunch",
    });
    expect(leftover.leftover).toBe(true);
    expect(leftover.title).toBe("Chili");
  });

  it("fill respects the protein cap", () => {
    const chicken = {
      ingredients: [
        { name: "chicken", quantity: "1", unit: "lb", aisle: "meat" },
      ],
    };
    saveStandaloneMeal({
      meal: meal({ title: "Chicken A", slot: "dinner", ...chicken }),
      slot: "dinner",
    });
    saveStandaloneMeal({
      meal: meal({ title: "Chicken B", slot: "dinner", ...chicken }),
      slot: "dinner",
    });
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    mask.wednesday.dinner = true;
    const plan = fillEmptySlots({
      weekStart: "2026-06-29",
      slotMask: mask,
      allowRepeats: true,
      leftoverLunches: false,
      maxProtein: 2,
      allergies: [],
      maxCookMinutes: 45,
    });
    const chickenDinners = plan.meals.filter(
      (item) =>
        item.slot === "dinner" &&
        item.ingredients.some((ingredient) =>
          ingredient.name.toLowerCase().includes("chicken"),
        ),
    );
    expect(chickenDinners.length).toBeLessThanOrEqual(2);
  });

  it("fill still uses a dinner recipe after it was leftover as lunch", () => {
    const source = saveStandaloneMeal({
      meal: meal({
        title: "Thighs for fill",
        slot: "dinner",
        ingredients: [
          { name: "chicken thighs", quantity: "1", unit: "lb", aisle: "meat" },
        ],
      }),
      slot: "dinner",
    });
    setMealStars(source.id, 5);
    const week = "2026-07-13";
    const placed = placeMeal({
      sourceMealId: source.id,
      day: "monday",
      slot: "dinner",
      weekStart: week,
    });
    saveLeftoverMeal({
      sourceMealId: placed.id,
      day: "tuesday",
      slot: "lunch",
    });
    openPlan("2026-07-20");
    const mask = emptyMask();
    mask.monday.dinner = true;
    const filled = fillEmptySlots({
      weekStart: "2026-07-20",
      slotMask: mask,
      allowRepeats: false,
      leftoverLunches: false,
      maxProtein: 2,
      allergies: [],
      maxCookMinutes: 45,
    });
    expect(filled.meals.some((item) => item.title === "Thighs for fill")).toBe(
      true,
    );
  });

  it("fill repeats, protein, and leftover lunches only look at the plan being filled", () => {
    const chicken = {
      ingredients: [
        { name: "chicken thighs", quantity: "1", unit: "lb", aisle: "meat" },
      ],
    };
    const thighs = saveStandaloneMeal({
      meal: meal({ title: "BBQ chicken thighs", slot: "dinner", ...chicken }),
      slot: "dinner",
    });
    setMealStars(thighs.id, 5);
    setMealStars(
      saveStandaloneMeal({
        meal: meal({ title: "Mushroom chicken skillet", slot: "dinner", ...chicken }),
        slot: "dinner",
      }).id,
      5,
    );
    setMealStars(
      saveStandaloneMeal({
        meal: meal({
          title: "Lemon herb salmon fill",
          slot: "dinner",
          ingredients: [
            { name: "salmon", quantity: "1", unit: "lb", aisle: "meat" },
          ],
        }),
        slot: "dinner",
      }).id,
      5,
    );
    const prior = placeMeal({
      sourceMealId: thighs.id,
      day: "thursday",
      slot: "dinner",
      weekStart: "2026-08-10",
    });
    saveLeftoverMeal({
      sourceMealId: prior.id,
      day: "friday",
      slot: "lunch",
    });
    const current = openPlan("2026-08-17");
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    mask.wednesday.dinner = true;
    mask.tuesday.lunch = true;
    const filled = fillEmptySlots({
      planId: current.id,
      weekStart: "2026-08-17",
      slotMask: mask,
      allowRepeats: false,
      leftoverLunches: true,
      maxProtein: 2,
      allergies: [],
      maxCookMinutes: 45,
    });
    expect(filled.id).toBe(current.id);
    expect(getPlan(prior.planId)?.meals).toHaveLength(2);
    const dinners = filled.meals.filter((item) => item.slot === "dinner");
    expect(dinners).toHaveLength(3);
    expect(dinners.some((item) => item.title === "BBQ chicken thighs")).toBe(
      true,
    );
    expect(
      dinners.filter((item) =>
        item.ingredients.some((ingredient) =>
          ingredient.name.toLowerCase().includes("chicken"),
        ),
      ),
    ).toHaveLength(2);
    const leftoverLunch = filled.meals.find(
      (item) => item.day === "tuesday" && item.slot === "lunch",
    );
    expect(leftoverLunch?.leftover).toBe(true);
    expect(leftoverLunch?.title).toBe(dinners.find((item) => item.day === "monday")?.title);
  });

  it("fill writes only to the given plan, not another week's leftover", () => {
    setMealStars(
      saveStandaloneMeal({
        meal: meal({ title: "Plan scoped chili", slot: "dinner" }),
        slot: "dinner",
      }).id,
      5,
    );
    const other = openPlan("2026-09-07");
    const current = openPlan("2026-09-14");
    const mask = emptyMask();
    mask.monday.dinner = true;
    const filled = fillEmptySlots({
      planId: current.id,
      weekStart: other.weekStart,
      slotMask: mask,
      allowRepeats: false,
      leftoverLunches: true,
      maxProtein: 2,
      allergies: [],
      maxCookMinutes: 45,
    });
    expect(filled.id).toBe(current.id);
    expect(filled.meals.map((item) => item.title)).toEqual(["Plan scoped chili"]);
    expect(getPlan(other.id)?.meals).toEqual([]);
  });

  it("refuses a second standalone with the same title", () => {
    saveStandaloneMeal({
      meal: meal({ title: "Unique stew", slot: "dinner" }),
      slot: "dinner",
    });
    expect(() =>
      saveStandaloneMeal({
        meal: meal({ title: "unique stew!", slot: "dinner" }),
        slot: "dinner",
      }),
    ).toThrow(/already in the library/i);
  });

  it("catalog lists a placed copy once", () => {
    const source = saveStandaloneMeal({
      meal: meal({ title: "Catalog chili", slot: "dinner" }),
      slot: "dinner",
    });
    placeMeal({
      sourceMealId: source.id,
      day: "monday",
      slot: "dinner",
      weekStart: "2026-07-06",
    });
    const matches = listCatalogMeals().filter((item) => item.title === "Catalog chili");
    expect(matches).toHaveLength(1);
  });

  it("dedupes extra standalone copies and keeps the week row", () => {
    const first = saveStandaloneMeal({
      meal: meal({ title: "Dedupe soup", slot: "dinner" }),
      slot: "dinner",
    });
    getDb().insert(mealsTable)
      .values({
        id: crypto.randomUUID(),
        planId: "",
        day: "monday",
        slot: "dinner",
        title: "Dedupe soup",
        whyItFits: "",
        cookMinutes: 20,
        method: "pot",
        ingredientsJson: "[]",
        stepsJson: "[]",
        usedWebSearch: 0,
        pinned: 0,
        weekStart: "",
        createdAt: "2020-01-01T00:00:00.000Z",
        extrasJson: "{}",
        draft: 0,
        stars: 0,
        takeout: 0,
        leftover: 0,
      })
      .run();
    expect(dedupeLibraryMeals()).toBeGreaterThanOrEqual(1);
    expect(
      listCatalogMeals().filter((item) => /dedupe soup/i.test(item.title)),
    ).toHaveLength(1);
    expect(listCatalogMeals().some((item) => item.id === first.id)).toBe(true);
  });
});

function getMealOnCurrent(day: "wednesday", slot: "dinner") {
  return getCurrentPlan()?.meals.find(
    (item) => item.day === day && item.slot === slot,
  );
}
