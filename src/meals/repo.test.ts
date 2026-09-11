import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { households, meals as mealsTable } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
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
  updatePlan,
} from "./repo";
import { EMPTY_EXTRAS, suggestionExtra } from "./extras";

let ident: Awaited<ReturnType<typeof createTestIdentity>>;
const extraUsers: string[] = [];

beforeAll(async () => {
  ident = await createTestIdentity();
});

afterEach(async () => {
  await Promise.all(extraUsers.splice(0).map(deleteTestUser));
  await resetDbForTests();
  const [row] = await getDb()
    .insert(households)
    .values({
      ownerId: ident.userId,
      name: "",
      dietStyle: "",
      notes: "",
      servings: 1,
    })
    .returning();
  ident.householdId = row!.id;
});

afterAll(async () => {
  await resetDbForTests();
  await deleteTestUser(ident.userId);
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
  it("listLibraryMeals does not return another household's dinner", async () => {
    const other = await createTestIdentity();
    extraUsers.push(other.userId);
    await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Mine", slot: "dinner" }),
      slot: "dinner",
    });
    await saveStandaloneMeal(other.householdId, {
      meal: meal({ title: "Theirs", slot: "dinner" }),
      slot: "dinner",
    });
    const mine = await listLibraryMeals(ident.householdId, "dinner");
    expect(mine.map((m) => m.title)).toEqual(["Mine"]);
  });

  it("saveStandaloneMeal stores plan_id null", async () => {
    const saved = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Typed chili" }),
      slot: "dinner",
    });
    expect(saved.planId).toBeNull();
  });

  it("saveGeneratedPlan twice keeps both, newest current", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;

    const first = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-01-05",
      slotMask,
      meals: [meal({ title: "First salmon" })],
    });
    const second = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-01-12",
      slotMask,
      meals: [meal({ title: "Second salmon" })],
    });

    expect(second.isCurrent).toBe(true);

    const plans = await listPlans(ident.householdId);
    expect(plans).toHaveLength(2);
    const byId = Object.fromEntries(plans.map((plan) => [plan.id, plan]));
    expect(byId[first.id]?.isCurrent).toBe(false);
    expect(byId[second.id]?.isCurrent).toBe(true);

    const current = await getCurrentPlan(ident.householdId);
    expect(current?.id).toBe(second.id);
    expect(current?.meals.map((item) => item.title)).toEqual(["Second salmon"]);
  });

  it("replaceMeal changes only that meal's title", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;

    const plan = await saveGeneratedPlan(ident.householdId, {
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

    const updated = await replaceMeal(ident.householdId, plan.id, monday!.id, {
      ...monday!,
      title: "Monday tofu",
    });

    expect(updated.title).toBe("Monday tofu");

    const reloaded = await getCurrentPlan(ident.householdId);
    expect(reloaded?.meals.find((item) => item.id === monday!.id)?.title).toBe(
      "Monday tofu",
    );
    expect(reloaded?.meals.find((item) => item.id === tuesday!.id)?.title).toBe(
      "Tuesday chicken",
    );
  });

  it("persists usedWebSearch on generate and swap", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;

    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-01-19",
      slotMask,
      meals: [meal({ title: "Searched salmon" })],
      usedWebSearch: true,
    });

    expect(plan.meals[0]?.usedWebSearch).toBe(true);
    expect((await getCurrentPlan(ident.householdId))?.meals[0]?.usedWebSearch).toBe(true);

    const swapped = await replaceMeal(
      ident.householdId,
      plan.id,
      plan.meals[0]!.id,
      meal({ title: "Invented tofu" }),
    );
    expect(swapped.usedWebSearch).toBe(false);
    expect((await getCurrentPlan(ident.householdId))?.meals[0]?.usedWebSearch).toBe(false);
  });

  it("stores a generate sourceUrl and lets swap replace it", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;

    const plan = await saveGeneratedPlan(ident.householdId, {
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

    const swapped = await replaceMeal(
      ident.householdId,
      plan.id,
      plan.meals[0]!.id,
      meal({
        title: "Cited trout",
        sourceUrl: "https://example.com/trout",
      }),
    );
    expect(swapped.sourceUrl).toBe("https://example.com/trout");
    expect((await getCurrentPlan(ident.householdId))?.meals[0]?.sourceUrl).toBe(
      "https://example.com/trout",
    );
  });

  it("lists unique library meals for a slot, newest week first", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.monday.lunch = true;

    await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-01-05",
      slotMask,
      meals: [
        meal({ title: "Library roast chicken" }),
        meal({ day: "monday", slot: "lunch", title: "Library orzo bowl" }),
      ],
    });
    await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-01-19",
      slotMask,
      meals: [meal({ title: "Library Roast Chicken" })],
    });

    const dinners = await listLibraryMeals(ident.householdId, "dinner");
    const roast = dinners.filter((item) =>
      /library roast chicken/i.test(item.title),
    );
    expect(roast).toHaveLength(1);
    expect(roast[0]?.title).toBe("Library Roast Chicken");
    expect(roast[0]?.weekStart).toBe("2026-01-19");
    expect(
      (await listLibraryMeals(ident.householdId, "lunch")).some(
        (item) => item.title === "Library orzo bowl",
      ),
    ).toBe(true);
  });

  it("places a library meal onto an empty current square without pinning it", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const sourcePlan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-02-02",
      slotMask,
      meals: [meal({ title: "Crockpot chicken" })],
    });
    const source = sourcePlan.meals[0]!;

    await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-02-09",
      slotMask,
      meals: [],
    });

    const placed = await placeMeal(ident.householdId, {
      sourceMealId: source.id,
      day: "wednesday",
      slot: "dinner",
      weekStart: "2026-02-09",
    });

    expect(placed.title).toBe("Crockpot chicken");
    expect(placed.day).toBe("wednesday");
    expect(placed.pinned).toBe(false);
    expect((await getMealOnCurrent("wednesday", "dinner"))?.id).toBe(placed.id);
    expect(sourcePlan.meals[0]?.title).toBe("Crockpot chicken");
  });

  it("replaces a filled square and keeps the previous pin state", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const older = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-02-16",
      slotMask,
      meals: [meal({ title: "Sheet-pan trout" })],
    });
    const current = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-02-23",
      slotMask,
      meals: [meal({ title: "Monday salmon" })],
    });
    await setPinned(ident.householdId, current.meals[0]!.id, true);

    const replaced = await placeMeal(ident.householdId, {
      sourceMealId: older.meals[0]!.id,
      day: "monday",
      slot: "dinner",
      weekStart: "2026-02-23",
    });

    expect(replaced.id).toBe(current.meals[0]!.id);
    expect(replaced.title).toBe("Sheet-pan trout");
    expect(replaced.pinned).toBe(true);
    expect((await getCurrentPlan(ident.householdId))?.meals).toHaveLength(1);
  });

  it("deletePlan removes the week but keeps meals in the library", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-04-06",
      slotMask,
      meals: [meal({ title: "Archive roast" })],
    });

    await deletePlan(ident.householdId, plan.id);

    expect((await listPlans(ident.householdId)).some((item) => item.id === plan.id)).toBe(false);
    expect((await getCurrentPlan(ident.householdId))?.id === plan.id).toBe(false);
    expect(
      (await listLibraryMeals(ident.householdId, "dinner")).some(
        (item) => item.title === "Archive roast",
      ),
    ).toBe(true);
    expect(
      (await listAllMeals(ident.householdId)).some((item) => item.title === "Archive roast"),
    ).toBe(true);
  });

  it("deleteMeal removes only that meal from the plan", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-03-16",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Delete me" }),
        meal({ day: "tuesday", title: "Keep me" }),
      ],
    });
    const doomed = plan.meals.find((item) => item.day === "monday")!;
    await deleteMeal(ident.householdId, doomed.id);

    const reloaded = await getCurrentPlan(ident.householdId);
    expect(reloaded?.meals.map((item) => item.title)).toEqual(["Keep me"]);
    expect(reloaded?.meals.find((item) => item.id === doomed.id)).toBeUndefined();
  });

  it("saveStandaloneMeal stores a library meal without a source URL", async () => {
    const saved = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Grandma chili", slot: "lunch" }),
      slot: "lunch",
    });
    expect(saved.planId).toBeNull();
    expect(saved.slot).toBe("lunch");
    expect(saved.title).toBe("Grandma chili");
    expect(saved.sourceUrl).toBeNull();
    expect(saved.usedWebSearch).toBe(false);
    expect(saved.pinned).toBe(false);
    expect((await listAllMeals(ident.householdId)).some((item) => item.id === saved.id)).toBe(true);
  });

  it("updateMeal changes recipe fields and leaves source and pin alone", async () => {
    const saved = await saveImportedMeal(ident.householdId, {
      meal: meal({ title: "Imported stew" }),
      slot: "dinner",
      sourceUrl: "https://example.com/stew",
    });
    const pinned = await setPinned(ident.householdId, saved.id, true);
    const updated = await updateMeal(ident.householdId, pinned.id, {
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

  it("pin-all and unpin-all flip every meal on the plan", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-03-02",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Salmon" }),
        meal({ day: "tuesday", title: "Chicken" }),
      ],
    });

    const pinned = await setPlanPinned(ident.householdId, plan.id, true);
    expect(pinned.meals.every((item) => item.pinned)).toBe(true);
    const unpinned = await setPlanPinned(ident.householdId, plan.id, false);
    expect(unpinned.meals.every((item) => item.pinned)).toBe(false);
  });

  it("mergeGeneratedPlan keeps pinned meals and replaces the rest", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-03-09",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Keep salmon" }),
        meal({ day: "tuesday", title: "Replace chicken" }),
      ],
    });
    await setPinned(
      ident.householdId,
      plan.meals.find((item) => item.day === "monday")!.id,
      true,
    );

    const merged = await mergeGeneratedPlan(ident.householdId, {
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

  it("new meals start with empty extras", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-04-06",
      slotMask,
      meals: [meal({ title: "Salmon" })],
    });
    expect(plan.meals[0]?.extras).toEqual(EMPTY_EXTRAS);
  });

  it("setMealExtra stores a side and clearMealExtra removes it", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-04-13",
      slotMask,
      meals: [meal({ title: "Salmon" })],
    });
    const extra = suggestionExtra({
      id: "extra-1",
      kind: "side",
      title: "Baked potato",
    });
    const withSide = await setMealExtra(ident.householdId, plan.meals[0]!.id, extra);
    expect(withSide.extras.side).toEqual(extra);
    expect((await getCurrentPlan(ident.householdId))?.meals[0]?.extras.side?.title).toBe("Baked potato");

    const cleared = await clearMealExtra(ident.householdId, plan.meals[0]!.id, "side");
    expect(cleared.extras.side).toBeNull();
    expect((await getCurrentPlan(ident.householdId))?.meals[0]?.extras).toEqual(EMPTY_EXTRAS);
  });

  it("replaceMeal keeps extras on the same row", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-04-20",
      slotMask,
      meals: [meal({ title: "Salmon" })],
    });
    const extra = suggestionExtra({
      id: "extra-keep",
      kind: "dessert",
      title: "Key lime pie",
    });
    await setMealExtra(ident.householdId, plan.meals[0]!.id, extra);

    const swapped = await replaceMeal(
      ident.householdId,
      plan.id,
      plan.meals[0]!.id,
      meal({ title: "Trout" }),
    );
    expect(swapped.title).toBe("Trout");
    expect(swapped.extras.dessert?.title).toBe("Key lime pie");
    expect((await getCurrentPlan(ident.householdId))?.meals[0]?.extras.dessert?.title).toBe(
      "Key lime pie",
    );
  });

  it("mergeGeneratedPlan drops extras on an unpinned occupant and keeps them on a pinned one", async () => {
    const slotMask = emptyMask();
    slotMask.monday.dinner = true;
    slotMask.tuesday.dinner = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-04-27",
      slotMask,
      meals: [
        meal({ day: "monday", title: "Keep salmon" }),
        meal({ day: "tuesday", title: "Replace chicken" }),
      ],
    });
    const monday = plan.meals.find((item) => item.day === "monday")!;
    const tuesday = plan.meals.find((item) => item.day === "tuesday")!;
    await setMealExtra(
      ident.householdId,
      monday.id,
      suggestionExtra({ id: "keep-side", kind: "side", title: "Slaw" }),
    );
    await setMealExtra(
      ident.householdId,
      tuesday.id,
      suggestionExtra({ id: "drop-side", kind: "side", title: "Fries" }),
    );
    await setPinned(ident.householdId, monday.id, true);

    const merged = await mergeGeneratedPlan(ident.householdId, {
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

  it("placeExtra copies a library recipe onto a lunch as a side", async () => {
    const slotMask = emptyMask();
    slotMask.monday.lunch = true;
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-05-11",
      slotMask,
      meals: [meal({ day: "monday", slot: "lunch", title: "Chicken pita" })],
    });
    const source = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Greek salad", slot: "side" }),
      slot: "side",
    });
    const updated = await placeExtra(ident.householdId, {
      sourceMealId: source.id,
      mealId: plan.meals[0]!.id,
      kind: "side",
    });
    expect(updated.extras.side?.title).toBe("Greek salad");
    expect(updated.extras.side?.mode).toBe("recipe");
    expect(updated.extras.side?.id).toBe(source.id);
  });

  it("placeMeal does not copy extras onto the week", async () => {
    const source = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Library chili" }),
      slot: "dinner",
    });
    await setMealExtra(
      ident.householdId,
      source.id,
      suggestionExtra({ id: "lib-side", kind: "side", title: "Cornbread" }),
    );

    const placed = await placeMeal(ident.householdId, {
      sourceMealId: source.id,
      day: "wednesday",
      slot: "dinner",
      weekStart: "2026-05-04",
    });
    expect(placed.title).toBe("Library chili");
    expect(placed.extras).toEqual(EMPTY_EXTRAS);
  });

  it("keeps drafts out of the library until they are approved", async () => {
    const draft = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Draft chili", slot: "dinner" }),
      slot: "dinner",
      draft: true,
    });
    expect((await listAllMeals(ident.householdId)).some((item) => item.id === draft.id)).toBe(false);
    expect((await listDraftMeals(ident.householdId)).some((item) => item.id === draft.id)).toBe(true);
    expect(
      (await listLibraryMeals(ident.householdId, "dinner")).some((item) => item.id === draft.id),
    ).toBe(false);

    const saved = await approveDraft(ident.householdId, draft.id);
    expect(saved.draft).toBe(false);
    expect((await listAllMeals(ident.householdId)).some((item) => item.id === draft.id)).toBe(true);
    expect(await listDraftMeals(ident.householdId)).toHaveLength(0);
  });

  it("deletes a rejected draft", async () => {
    const draft = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Reject me", slot: "lunch" }),
      slot: "lunch",
      draft: true,
    });
    await rejectDraft(ident.householdId, draft.id);
    expect((await listDraftMeals(ident.householdId)).some((item) => item.id === draft.id)).toBe(false);
    expect((await listAllMeals(ident.householdId)).some((item) => item.id === draft.id)).toBe(false);
  });

  it("rates a saved meal and refuses a draft", async () => {
    const saved = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Rated stew", slot: "dinner" }),
      slot: "dinner",
    });
    expect((await setMealStars(ident.householdId, saved.id, 4)).stars).toBe(4);
    const draft = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Unrated draft", slot: "dinner" }),
      slot: "dinner",
      draft: true,
    });
    await expect(setMealStars(ident.householdId, draft.id, 5)).rejects.toThrow(/draft/i);
  });

  it("renames and favorites a plan", async () => {
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-05-25",
      slotMask: emptyMask(),
      meals: [meal({ title: "May chili" })],
    });
    const named = await updatePlan(ident.householdId, {
      planId: plan.id,
      name: "  Beach week  ",
    });
    expect(named.name).toBe("Beach week");
    const starred = await updatePlan(ident.householdId, {
      planId: plan.id,
      favorited: true,
    });
    expect(starred.favorited).toBe(true);
    expect(
      (await listPlans(ident.householdId)).find((item) => item.id === plan.id)?.name,
    ).toBe("Beach week");
  });

  it("opens another week without deleting this week", async () => {
    const first = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-06-01",
      slotMask: emptyMask(),
      meals: [meal({ title: "June chili" })],
    });
    const next = await openPlan(ident.householdId, "2026-06-08");
    expect(next.weekStart).toBe("2026-06-08");
    expect(next.isCurrent).toBe(true);
    expect(
      (await getPlan(ident.householdId, first.id))?.meals.some(
        (item) => item.title === "June chili",
      ),
    ).toBe(true);
    const back = await openPlan(ident.householdId, "2026-06-01");
    expect(back.id).toBe(first.id);
    expect(back.meals.some((item) => item.title === "June chili")).toBe(true);
  });

  it("opens this calendar week when the current plan is in the past", async () => {
    const past = await openPlan(ident.householdId, "2026-08-24");
    const opened = await resolveOpenPlan(
      ident.householdId,
      undefined,
      new Date(2026, 8, 6),
    );
    expect(opened.weekStart).toBe("2026-08-31");
    expect(opened.isCurrent).toBe(true);
    expect((await getPlan(ident.householdId, past.id))?.isCurrent).toBe(false);
  });

  it("keeps a future current plan instead of snapping back", async () => {
    const next = await openPlan(ident.householdId, "2026-09-07");
    const opened = await resolveOpenPlan(
      ident.householdId,
      undefined,
      new Date(2026, 8, 6),
    );
    expect(opened.id).toBe(next.id);
    expect(opened.weekStart).toBe("2026-09-07");
  });

  it("saves takeout without ingredients", async () => {
    const mealRow = await saveTakeoutMeal(ident.householdId, {
      day: "friday",
      slot: "dinner",
      title: "Thai Palace",
      weekStart: "2026-06-15",
    });
    expect(mealRow.takeout).toBe(true);
    expect(mealRow.ingredients).toEqual([]);
    expect(
      (await listLibraryMeals(ident.householdId, "dinner")).some(
        (item) => item.id === mealRow.id,
      ),
    ).toBe(false);
  });

  it("copies leftovers onto another cell", async () => {
    const plan = await saveGeneratedPlan(ident.householdId, {
      weekStart: "2026-06-22",
      slotMask: emptyMask(),
      meals: [meal({ title: "Chili", day: "monday", slot: "dinner" })],
    });
    const source = plan.meals[0]!;
    const leftover = await saveLeftoverMeal(ident.householdId, {
      sourceMealId: source.id,
      day: "tuesday",
      slot: "lunch",
    });
    expect(leftover.leftover).toBe(true);
    expect(leftover.title).toBe("Chili");
  });

  it("fill respects the protein cap", async () => {
    const chicken = {
      ingredients: [
        { name: "chicken", quantity: "1", unit: "lb", aisle: "meat" },
      ],
    };
    await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Chicken A", slot: "dinner", ...chicken }),
      slot: "dinner",
    });
    await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Chicken B", slot: "dinner", ...chicken }),
      slot: "dinner",
    });
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    mask.wednesday.dinner = true;
    const plan = await fillEmptySlots(ident.householdId, {
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

  it("fill still uses a dinner recipe after it was leftover as lunch", async () => {
    const source = await saveStandaloneMeal(ident.householdId, {
      meal: meal({
        title: "Thighs for fill",
        slot: "dinner",
        ingredients: [
          { name: "chicken thighs", quantity: "1", unit: "lb", aisle: "meat" },
        ],
      }),
      slot: "dinner",
    });
    await setMealStars(ident.householdId, source.id, 5);
    const week = "2026-07-13";
    const placed = await placeMeal(ident.householdId, {
      sourceMealId: source.id,
      day: "monday",
      slot: "dinner",
      weekStart: week,
    });
    await saveLeftoverMeal(ident.householdId, {
      sourceMealId: placed.id,
      day: "tuesday",
      slot: "lunch",
    });
    await openPlan(ident.householdId, "2026-07-20");
    const mask = emptyMask();
    mask.monday.dinner = true;
    const filled = await fillEmptySlots(ident.householdId, {
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

  it("fill repeats, protein, and leftover lunches only look at the plan being filled", async () => {
    const chicken = {
      ingredients: [
        { name: "chicken thighs", quantity: "1", unit: "lb", aisle: "meat" },
      ],
    };
    const thighs = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "BBQ chicken thighs", slot: "dinner", ...chicken }),
      slot: "dinner",
    });
    await setMealStars(ident.householdId, thighs.id, 5);
    await setMealStars(
      ident.householdId,
      (
        await saveStandaloneMeal(ident.householdId, {
          meal: meal({ title: "Mushroom chicken skillet", slot: "dinner", ...chicken }),
          slot: "dinner",
        })
      ).id,
      5,
    );
    await setMealStars(
      ident.householdId,
      (
        await saveStandaloneMeal(ident.householdId, {
          meal: meal({
            title: "Lemon herb salmon fill",
            slot: "dinner",
            ingredients: [
              { name: "salmon", quantity: "1", unit: "lb", aisle: "meat" },
            ],
          }),
          slot: "dinner",
        })
      ).id,
      5,
    );
    const prior = await placeMeal(ident.householdId, {
      sourceMealId: thighs.id,
      day: "thursday",
      slot: "dinner",
      weekStart: "2026-08-10",
    });
    await saveLeftoverMeal(ident.householdId, {
      sourceMealId: prior.id,
      day: "friday",
      slot: "lunch",
    });
    const current = await openPlan(ident.householdId, "2026-08-17");
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    mask.wednesday.dinner = true;
    mask.tuesday.lunch = true;
    const filled = await fillEmptySlots(ident.householdId, {
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
    expect(
      (await getPlan(ident.householdId, prior.planId!))?.meals,
    ).toHaveLength(2);
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

  it("fill writes only to the given plan, not another week's leftover", async () => {
    await setMealStars(
      ident.householdId,
      (
        await saveStandaloneMeal(ident.householdId, {
          meal: meal({ title: "Plan scoped chili", slot: "dinner" }),
          slot: "dinner",
        })
      ).id,
      5,
    );
    const other = await openPlan(ident.householdId, "2026-09-07");
    const current = await openPlan(ident.householdId, "2026-09-14");
    const mask = emptyMask();
    mask.monday.dinner = true;
    const filled = await fillEmptySlots(ident.householdId, {
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
    expect((await getPlan(ident.householdId, other.id))?.meals).toEqual([]);
  });

  it("refuses a second standalone with the same title", async () => {
    await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Unique stew", slot: "dinner" }),
      slot: "dinner",
    });
    await expect(
      saveStandaloneMeal(ident.householdId, {
        meal: meal({ title: "unique stew!", slot: "dinner" }),
        slot: "dinner",
      }),
    ).rejects.toThrow(/already in the library/i);
  });

  it("catalog lists a placed copy once", async () => {
    const source = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Catalog chili", slot: "dinner" }),
      slot: "dinner",
    });
    await placeMeal(ident.householdId, {
      sourceMealId: source.id,
      day: "monday",
      slot: "dinner",
      weekStart: "2026-07-06",
    });
    const matches = (await listCatalogMeals(ident.householdId)).filter(
      (item) => item.title === "Catalog chili",
    );
    expect(matches).toHaveLength(1);
  });

  it("dedupes extra standalone copies and keeps the week row", async () => {
    const first = await saveStandaloneMeal(ident.householdId, {
      meal: meal({ title: "Dedupe soup", slot: "dinner" }),
      slot: "dinner",
    });
    await getDb().insert(mealsTable).values({
      householdId: ident.householdId,
      planId: null,
      day: "monday",
      slot: "dinner",
      title: "Dedupe soup",
      whyItFits: "",
      cookMinutes: 20,
      method: "pot",
      ingredients: [],
      steps: [],
      usedWebSearch: false,
      pinned: false,
      weekStart: "",
      createdAt: "2020-01-01T00:00:00.000Z",
      extras: EMPTY_EXTRAS,
      draft: false,
      stars: 0,
      takeout: false,
      leftover: false,
    });
    expect(await dedupeLibraryMeals(ident.householdId)).toBeGreaterThanOrEqual(1);
    expect(
      (await listCatalogMeals(ident.householdId)).filter((item) =>
        /dedupe soup/i.test(item.title),
      ),
    ).toHaveLength(1);
    expect(
      (await listCatalogMeals(ident.householdId)).some((item) => item.id === first.id),
    ).toBe(true);
  });
});

async function getMealOnCurrent(day: "wednesday", slot: "dinner") {
  return (await getCurrentPlan(ident.householdId))?.meals.find(
    (item) => item.day === day && item.slot === slot,
  );
}
