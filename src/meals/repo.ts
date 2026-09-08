import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meals, weekPlans } from "@/lib/schema";
import type {
  DayOfWeek,
  ExtraKind,
  GeneratedMeal,
  Ingredient,
  LibraryMeal,
  Meal,
  MealExtra,
  MealExtras,
  MealSlot,
  SlotMask,
  WeekPlan,
} from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { emptySlotMask } from "@/lib/slot-mask";
import { mondayOf } from "@/lib/week";
import { isDuplicateTitle, normalizeTitle } from "./duplicates";
import { EMPTY_EXTRAS, extraFromMeal, parseMealExtras } from "./extras";
import { uniqueCatalogMeals } from "./catalog";
import { pickFillMeals } from "./fill";

type PlanRow = typeof weekPlans.$inferSelect;
type MealRow = typeof meals.$inferSelect;

function mapMeal(row: MealRow): Meal {
  return {
    id: row.id,
    planId: row.planId,
    day: row.day as Meal["day"],
    slot: row.slot as Meal["slot"],
    title: row.title,
    whyItFits: row.whyItFits,
    cookMinutes: row.cookMinutes,
    method: row.method,
    ingredients: JSON.parse(row.ingredientsJson) as Ingredient[],
    steps: JSON.parse(row.stepsJson) as string[],
    usedWebSearch: row.usedWebSearch === 1,
    pinned: row.pinned === 1,
    createdAt: row.createdAt,
    sourceUrl: row.sourceUrl,
    extras: parseMealExtras(row.extrasJson),
    draft: row.draft === 1,
    stars: row.stars,
    takeout: row.takeout === 1,
    leftover: row.leftover === 1,
  };
}

function sortMeals(items: Meal[]): Meal[] {
  return [...items].sort((a, b) => {
    const dayDelta = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDelta !== 0) return dayDelta;
    return SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot);
  });
}

function loadMeals(planId: string): Meal[] {
  const db = getDb();
  return sortMeals(
    db.select().from(meals).where(eq(meals.planId, planId)).all().map(mapMeal),
  );
}

function mapPlan(row: PlanRow, planMeals: Meal[]): WeekPlan {
  return {
    id: row.id,
    weekStart: row.weekStart,
    isCurrent: row.isCurrent === 1,
    slotMask: JSON.parse(row.slotMaskJson) as SlotMask,
    meals: planMeals,
    name: row.name ?? "",
    favorited: row.favorited === 1,
  };
}

function mealInsertValues(
  planId: string,
  meal: GeneratedMeal,
  extras: {
    usedWebSearch: number;
    pinned: number;
    weekStart: string;
    createdAt?: string;
    sourceUrl?: string | null;
    id?: string;
    extras?: MealExtras;
    draft?: number;
    stars?: number;
    takeout?: number;
    leftover?: number;
  },
) {
  return {
    id: extras.id ?? crypto.randomUUID(),
    planId,
    day: meal.day,
    slot: meal.slot,
    title: meal.title,
    whyItFits: meal.whyItFits,
    cookMinutes: meal.cookMinutes,
    method: meal.method,
    ingredientsJson: JSON.stringify(meal.ingredients),
    stepsJson: JSON.stringify(meal.steps),
    usedWebSearch: extras.usedWebSearch,
    pinned: extras.pinned,
    weekStart: extras.weekStart,
    createdAt: extras.createdAt ?? new Date().toISOString(),
    sourceUrl: extras.sourceUrl ?? meal.sourceUrl ?? null,
    extrasJson: JSON.stringify(extras.extras ?? EMPTY_EXTRAS),
    draft: extras.draft ?? 0,
    stars: extras.stars ?? 0,
    takeout: extras.takeout ?? 0,
    leftover: extras.leftover ?? 0,
  };
}

export function listPlans(): Pick<
  WeekPlan,
  "id" | "weekStart" | "isCurrent" | "name" | "favorited"
>[] {
  const db = getDb();
  return db
    .select()
    .from(weekPlans)
    .all()
    .map((row) => ({
      id: row.id,
      weekStart: row.weekStart,
      isCurrent: row.isCurrent === 1,
      name: row.name ?? "",
      favorited: row.favorited === 1,
    }))
    .sort((a, b) => {
      const weekDelta = b.weekStart.localeCompare(a.weekStart);
      if (weekDelta !== 0) return weekDelta;
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.id.localeCompare(a.id);
    });
}

export function getPlan(id: string): WeekPlan | null {
  const db = getDb();
  const row = db.select().from(weekPlans).where(eq(weekPlans.id, id)).get();
  if (!row) return null;
  return mapPlan(row, loadMeals(row.id));
}

export function getCurrentPlan(): WeekPlan | null {
  const db = getDb();
  const row = db
    .select()
    .from(weekPlans)
    .where(eq(weekPlans.isCurrent, 1))
    .get();
  if (!row) return null;
  return mapPlan(row, loadMeals(row.id));
}

export function listAllMeals(): Meal[] {
  const db = getDb();
  return db
    .select()
    .from(meals)
    .all()
    .map(mapMeal)
    .filter((meal) => !meal.draft)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function listCatalogMeals(): Meal[] {
  return uniqueCatalogMeals(listAllMeals());
}

export function titleTaken(title: string, exceptId?: string): boolean {
  return listCatalogMeals().some(
    (meal) => meal.id !== exceptId && isDuplicateTitle(meal.title, [title]),
  );
}

export function listDraftMeals(): Meal[] {
  const db = getDb();
  return db
    .select()
    .from(meals)
    .all()
    .map(mapMeal)
    .filter((meal) => meal.draft)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function saveStandaloneMeal(input: {
  meal: GeneratedMeal;
  slot: MealSlot;
  sourceUrl?: string | null;
  usedWebSearch?: boolean;
  draft?: boolean;
}): Meal {
  if (input.draft !== true && titleTaken(input.meal.title)) {
    throw new Error("That recipe is already in the library.");
  }
  const db = getDb();
  const weekStart = mondayOf(new Date());
  const row = mealInsertValues(
    "",
    { ...input.meal, day: "monday", slot: input.slot },
    {
      usedWebSearch: input.usedWebSearch === true ? 1 : 0,
      pinned: 0,
      weekStart,
      sourceUrl: input.sourceUrl ?? null,
      draft: input.draft === true ? 1 : 0,
    },
  );
  db.insert(meals).values(row).run();
  return mapMeal(row);
}

export function saveDraftMeals(
  items: Array<{
    meal: GeneratedMeal;
    slot: MealSlot;
    usedWebSearch?: boolean;
  }>,
): Meal[] {
  return items.map((item) =>
    saveStandaloneMeal({ ...item, draft: true }),
  );
}

export function approveDraft(mealId: string): Meal {
  const db = getDb();
  const existing = db.select().from(meals).where(eq(meals.id, mealId)).get();
  if (!existing) throw new Error("Meal not found");
  if (existing.draft !== 1) throw new Error("Not a draft");
  if (titleTaken(existing.title, existing.id)) {
    throw new Error("That recipe is already in the library.");
  }
  db.update(meals).set({ draft: 0 }).where(eq(meals.id, mealId)).run();
  return mapMeal({ ...existing, draft: 0 });
}

export function rejectDraft(mealId: string): void {
  const existing = getMeal(mealId);
  if (!existing) throw new Error("Meal not found");
  if (!existing.draft) throw new Error("Not a draft");
  deleteMeal(mealId);
}

export function setMealStars(mealId: string, stars: number): Meal {
  if (!Number.isInteger(stars) || stars < 0 || stars > 5) {
    throw new Error("Stars must be 0 through 5.");
  }
  const db = getDb();
  const existing = db.select().from(meals).where(eq(meals.id, mealId)).get();
  if (!existing) throw new Error("Meal not found");
  if (existing.draft === 1) throw new Error("Drafts cannot be rated.");
  db.update(meals).set({ stars }).where(eq(meals.id, mealId)).run();
  return mapMeal({ ...existing, stars });
}

export function saveImportedMeal(input: {
  meal: GeneratedMeal;
  slot: MealSlot;
  sourceUrl: string;
  usedWebSearch?: boolean;
}): Meal {
  return saveStandaloneMeal(input);
}

export function getMeal(id: string): Meal | null {
  const db = getDb();
  const row = db.select().from(meals).where(eq(meals.id, id)).get();
  return row ? mapMeal(row) : null;
}

export function setMealExtra(mealId: string, extra: MealExtra): Meal {
  const db = getDb();
  const existing = db.select().from(meals).where(eq(meals.id, mealId)).get();
  if (!existing) throw new Error("Meal not found");
  const extras = {
    ...parseMealExtras(existing.extrasJson),
    [extra.kind]: extra,
  };
  const extrasJson = JSON.stringify(extras);
  db.update(meals).set({ extrasJson }).where(eq(meals.id, mealId)).run();
  return mapMeal({ ...existing, extrasJson });
}

export function placeExtra(input: {
  sourceMealId: string;
  mealId: string;
  kind: ExtraKind;
}): Meal {
  const source = getMeal(input.sourceMealId);
  if (!source) throw new Error("Meal not found");
  if (source.draft) throw new Error("Meal not found");
  const parent = getMeal(input.mealId);
  if (!parent) throw new Error("Meal not found");
  const current = getCurrentPlan();
  if (!current || parent.planId !== current.id) {
    throw new Error("Sides and desserts can only be added on this week.");
  }
  if (parent.slot !== "lunch" && parent.slot !== "dinner") {
    throw new Error("Breakfasts don’t have sides or desserts.");
  }
  if (parent.extras[input.kind]) {
    throw new Error(`That meal already has a ${input.kind}.`);
  }
  return setMealExtra(parent.id, extraFromMeal(source, input.kind));
}

export function clearMealExtra(
  mealId: string,
  kind: ExtraKind,
): Meal {
  const db = getDb();
  const existing = db.select().from(meals).where(eq(meals.id, mealId)).get();
  if (!existing) throw new Error("Meal not found");
  const extras = {
    ...parseMealExtras(existing.extrasJson),
    [kind]: null,
  };
  const extrasJson = JSON.stringify(extras);
  db.update(meals).set({ extrasJson }).where(eq(meals.id, mealId)).run();
  return mapMeal({ ...existing, extrasJson });
}

export function updateMeal(
  id: string,
  fields: {
    title: string;
    whyItFits: string;
    cookMinutes: number;
    method: string;
    ingredients: Ingredient[];
    steps: string[];
  },
): Meal {
  const db = getDb();
  const existing = db.select().from(meals).where(eq(meals.id, id)).get();
  if (!existing) throw new Error("Meal not found");
  if (titleTaken(fields.title, id)) {
    throw new Error("That recipe is already in the library.");
  }
  db.update(meals)
    .set({
      title: fields.title,
      whyItFits: fields.whyItFits,
      cookMinutes: fields.cookMinutes,
      method: fields.method,
      ingredientsJson: JSON.stringify(fields.ingredients),
      stepsJson: JSON.stringify(fields.steps),
    })
    .where(eq(meals.id, id))
    .run();
  return mapMeal({
    ...existing,
    title: fields.title,
    whyItFits: fields.whyItFits,
    cookMinutes: fields.cookMinutes,
    method: fields.method,
    ingredientsJson: JSON.stringify(fields.ingredients),
    stepsJson: JSON.stringify(fields.steps),
  });
}

export function saveGeneratedPlan(input: {
  weekStart: string;
  slotMask: SlotMask;
  meals: GeneratedMeal[];
  usedWebSearch?: boolean;
}): WeekPlan {
  const db = getDb();
  const planId = crypto.randomUUID();
  const usedWebSearch = input.usedWebSearch === true ? 1 : 0;
  const mealRows = input.meals.map((meal) =>
    mealInsertValues(planId, meal, {
      usedWebSearch,
      pinned: 0,
      weekStart: input.weekStart,
    }),
  );

  db.transaction((tx) => {
    tx.update(weekPlans).set({ isCurrent: 0 }).run();
    tx.insert(weekPlans)
      .values({
        id: planId,
        weekStart: input.weekStart,
        isCurrent: 1,
        slotMaskJson: JSON.stringify(input.slotMask),
        name: "",
        favorited: 0,
      })
      .run();
    if (mealRows.length > 0) {
      tx.insert(meals).values(mealRows).run();
    }
  });

  return {
    id: planId,
    weekStart: input.weekStart,
    isCurrent: true,
    slotMask: input.slotMask,
    meals: sortMeals(mealRows.map(mapMeal)),
    name: "",
    favorited: false,
  };
}

export function mergeGeneratedPlan(input: {
  weekStart: string;
  slotMask: SlotMask;
  meals: GeneratedMeal[];
  usedWebSearch?: boolean;
}): WeekPlan {
  const current = getCurrentPlan();
  if (!current) {
    return saveGeneratedPlan(input);
  }

  const db = getDb();
  const usedWebSearch = input.usedWebSearch === true ? 1 : 0;
  const incoming = input.meals;

  db.transaction((tx) => {
    tx.update(weekPlans)
      .set({ slotMaskJson: JSON.stringify(input.slotMask) })
      .where(eq(weekPlans.id, current.id))
      .run();

    for (const next of incoming) {
      const existing = current.meals.find(
        (meal) => meal.day === next.day && meal.slot === next.slot,
      );
      if (existing?.pinned) continue;

      if (existing) {
        tx.delete(meals).where(eq(meals.id, existing.id)).run();
      }
      tx.insert(meals)
        .values(
          mealInsertValues(current.id, next, {
            usedWebSearch,
            pinned: 0,
            weekStart: current.weekStart,
          }),
        )
        .run();
    }
  });

  return getPlan(current.id) ?? current;
}

export function replaceMeal(
  planId: string,
  mealId: string,
  next: GeneratedMeal,
  usedWebSearch = false,
): Meal {
  const db = getDb();
  const existing = db
    .select()
    .from(meals)
    .where(eq(meals.id, mealId))
    .get();
  if (!existing || existing.planId !== planId) {
    throw new Error("Meal not found");
  }

  const row = mealInsertValues(planId, next, {
    id: mealId,
    usedWebSearch: usedWebSearch ? 1 : 0,
    pinned: existing.pinned,
    weekStart: existing.weekStart,
    createdAt: existing.createdAt,
    sourceUrl: next.sourceUrl ?? null,
    extras: parseMealExtras(existing.extrasJson),
    draft: existing.draft,
    stars: existing.stars,
  });
  db.update(meals).set(row).where(eq(meals.id, mealId)).run();
  return mapMeal(row);
}

export function listLibraryMeals(slot: MealSlot): LibraryMeal[] {
  const db = getDb();
  const rows = db.select().from(meals).where(eq(meals.slot, slot)).all();

  rows.sort((a, b) => {
    const weekDelta = b.weekStart.localeCompare(a.weekStart);
    if (weekDelta !== 0) return weekDelta;
    return b.id.localeCompare(a.id);
  });

  const seen = new Set<string>();
  const unique: LibraryMeal[] = [];
  for (const row of rows) {
    if (row.draft === 1 || row.takeout === 1) continue;
    const key = normalizeTitle(row.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: row.id,
      title: row.title,
      whyItFits: row.whyItFits,
      cookMinutes: row.cookMinutes,
      method: row.method,
      slot: row.slot as MealSlot,
      weekStart: row.weekStart,
      usedWebSearch: row.usedWebSearch === 1,
    });
  }
  return unique;
}

export function ensureCurrentPlan(weekStart: string): WeekPlan {
  return openPlan(weekStart);
}

/** Open a specific plan, or this calendar week if current is in the past. */
export function resolveOpenPlan(
  planId?: string,
  today: Date = new Date(),
): WeekPlan {
  if (planId) {
    const requested = getPlan(planId);
    if (requested) return requested;
  }
  const thisMonday = mondayOf(today);
  const current = getCurrentPlan();
  if (current && current.weekStart >= thisMonday) return current;
  return openPlan(thisMonday);
}

export function openPlan(weekStart: string): WeekPlan {
  const db = getDb();
  const rows = db
    .select()
    .from(weekPlans)
    .all()
    .filter((row) => row.weekStart === weekStart)
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return b.isCurrent - a.isCurrent;
      return b.id.localeCompare(a.id);
    });
  if (rows[0]) {
    const id = rows[0].id;
    db.transaction((tx) => {
      tx.update(weekPlans).set({ isCurrent: 0 }).run();
      tx.update(weekPlans).set({ isCurrent: 1 }).where(eq(weekPlans.id, id)).run();
    });
    return getPlan(id)!;
  }
  return saveGeneratedPlan({
    weekStart,
    slotMask: emptySlotMask(),
    meals: [],
  });
}

export function placeMeal(input: {
  sourceMealId: string;
  day: DayOfWeek;
  slot: MealSlot;
  weekStart: string;
}): Meal {
  const source = getMeal(input.sourceMealId);
  if (!source) throw new Error("Meal not found");
  if (source.draft) throw new Error("Meal not found");

  const plan = ensureCurrentPlan(input.weekStart);
  const db = getDb();
  const occupant = plan.meals.find(
    (meal) => meal.day === input.day && meal.slot === input.slot,
  );
  const copy: GeneratedMeal = {
    day: input.day,
    slot: input.slot,
    title: source.title,
    whyItFits: source.whyItFits,
    cookMinutes: source.cookMinutes,
    method: source.method,
    ingredients: source.ingredients,
    steps: source.steps,
  };
  const usedWebSearch = source.usedWebSearch ? 1 : 0;

  if (occupant) {
    const row = mealInsertValues(plan.id, copy, {
      id: occupant.id,
      usedWebSearch,
      pinned: occupant.pinned ? 1 : 0,
      weekStart: plan.weekStart,
      sourceUrl: source.sourceUrl,
    });
    db.update(meals).set(row).where(eq(meals.id, occupant.id)).run();
    return mapMeal(row);
  }

  const row = mealInsertValues(plan.id, copy, {
    usedWebSearch,
    pinned: 0,
    weekStart: plan.weekStart,
    sourceUrl: source.sourceUrl,
  });
  db.insert(meals).values(row).run();
  return mapMeal(row);
}

function copyOntoPlan(input: {
  source: Meal;
  day: DayOfWeek;
  slot: MealSlot;
  leftover: boolean;
  weekStart: string;
  planId?: string;
}): Meal {
  const plan = input.planId
    ? getPlan(input.planId)
    : openPlan(input.weekStart);
  if (!plan) throw new Error("Plan not found");
  const db = getDb();
  const occupant = plan.meals.find(
    (meal) => meal.day === input.day && meal.slot === input.slot,
  );
  const copy: GeneratedMeal = {
    day: input.day,
    slot: input.slot,
    title: input.source.title,
    whyItFits: input.source.whyItFits,
    cookMinutes: input.source.cookMinutes,
    method: input.source.method,
    ingredients: input.source.ingredients,
    steps: input.source.steps,
  };
  const extras = {
    usedWebSearch: input.source.usedWebSearch ? 1 : 0,
    pinned: occupant?.pinned ? 1 : 0,
    weekStart: plan.weekStart,
    sourceUrl: input.source.sourceUrl,
    leftover: input.leftover ? 1 : 0,
    takeout: 0,
  };
  if (occupant) {
    const row = mealInsertValues(plan.id, copy, { ...extras, id: occupant.id });
    db.update(meals).set(row).where(eq(meals.id, occupant.id)).run();
    return mapMeal(row);
  }
  const row = mealInsertValues(plan.id, copy, extras);
  db.insert(meals).values(row).run();
  return mapMeal(row);
}

export function saveTakeoutMeal(input: {
  day: DayOfWeek;
  slot: MealSlot;
  title?: string;
  weekStart: string;
}): Meal {
  const plan = openPlan(input.weekStart);
  const occupant = plan.meals.find(
    (meal) => meal.day === input.day && meal.slot === input.slot,
  );
  const title = input.title?.trim() || "Takeout";
  const generated: GeneratedMeal = {
    day: input.day,
    slot: input.slot,
    title,
    whyItFits: "Restaurant / takeout",
    cookMinutes: 0,
    method: "takeout",
    ingredients: [],
    steps: [],
  };
  const extras = {
    usedWebSearch: 0,
    pinned: occupant?.pinned ? 1 : 0,
    weekStart: plan.weekStart,
    sourceUrl: null as string | null,
    takeout: 1,
    leftover: 0,
    extras: EMPTY_EXTRAS,
  };
  const db = getDb();
  if (occupant) {
    const row = mealInsertValues(plan.id, generated, {
      ...extras,
      id: occupant.id,
    });
    db.update(meals).set(row).where(eq(meals.id, occupant.id)).run();
    return mapMeal(row);
  }
  const row = mealInsertValues(plan.id, generated, extras);
  db.insert(meals).values(row).run();
  return mapMeal(row);
}

export function saveLeftoverMeal(input: {
  sourceMealId: string;
  day: DayOfWeek;
  slot: MealSlot;
}): Meal {
  const source = getMeal(input.sourceMealId);
  if (!source) throw new Error("Meal not found");
  if (source.takeout) throw new Error("Takeout cannot be leftovers.");
  const current = getCurrentPlan();
  if (!current || source.planId !== current.id) {
    throw new Error("Leftovers can only be copied from this week.");
  }
  return copyOntoPlan({
    source,
    day: input.day,
    slot: input.slot,
    leftover: true,
    weekStart: current.weekStart,
  });
}

export function fillEmptySlots(input: {
  weekStart: string;
  planId?: string;
  slotMask: SlotMask;
  allowRepeats: boolean;
  leftoverLunches: boolean;
  maxProtein: number;
  allergies: string[];
  maxCookMinutes: number;
}): WeekPlan {
  const plan = input.planId
    ? getPlan(input.planId) ?? openPlan(input.weekStart)
    : openPlan(input.weekStart);
  const db = getDb();
  db.update(weekPlans)
    .set({ slotMaskJson: JSON.stringify(input.slotMask) })
    .where(eq(weekPlans.id, plan.id))
    .run();

  const picks = pickFillMeals({
    mask: input.slotMask,
    occupied: plan.meals,
    library: listCatalogMeals(),
    allergies: input.allergies,
    maxCookMinutes: input.maxCookMinutes,
    allowRepeats: input.allowRepeats,
    leftoverLunches: input.leftoverLunches,
    maxProtein: input.maxProtein,
  });

  for (const pick of picks) {
    copyOntoPlan({
      source: pick.source,
      day: pick.day,
      slot: pick.slot,
      leftover: pick.leftover,
      weekStart: plan.weekStart,
      planId: plan.id,
    });
  }
  return getPlan(plan.id) ?? plan;
}

export function updatePlan(input: {
  planId: string;
  name?: string;
  favorited?: boolean;
}): WeekPlan {
  const existing = getPlan(input.planId);
  if (!existing) throw new Error("Plan not found");
  const patch: { name?: string; favorited?: number } = {};
  if (input.name !== undefined) {
    patch.name = input.name.trim().slice(0, 60);
  }
  if (input.favorited !== undefined) {
    patch.favorited = input.favorited ? 1 : 0;
  }
  if (Object.keys(patch).length > 0) {
    getDb()
      .update(weekPlans)
      .set(patch)
      .where(eq(weekPlans.id, input.planId))
      .run();
  }
  return getPlan(input.planId)!;
}

export function deletePlan(planId: string): void {
  const db = getDb();
  const existing = db
    .select()
    .from(weekPlans)
    .where(eq(weekPlans.id, planId))
    .get();
  if (!existing) throw new Error("Plan not found");
  db.delete(weekPlans).where(eq(weekPlans.id, planId)).run();
}

export function deleteMeal(mealId: string): void {
  const db = getDb();
  const existing = db.select().from(meals).where(eq(meals.id, mealId)).get();
  if (!existing) throw new Error("Meal not found");
  db.delete(meals).where(eq(meals.id, mealId)).run();
}

export function setPinned(mealId: string, pinned: boolean): Meal {
  const db = getDb();
  const existing = db.select().from(meals).where(eq(meals.id, mealId)).get();
  if (!existing) throw new Error("Meal not found");
  db.update(meals)
    .set({ pinned: pinned ? 1 : 0 })
    .where(eq(meals.id, mealId))
    .run();
  return mapMeal({ ...existing, pinned: pinned ? 1 : 0 });
}

export function setPlanPinned(planId: string, pinned: boolean): WeekPlan {
  const plan = getPlan(planId);
  if (!plan) throw new Error("Plan not found");
  const db = getDb();
  db.update(meals)
    .set({ pinned: pinned ? 1 : 0 })
    .where(eq(meals.planId, planId))
    .run();
  return getPlan(planId) ?? plan;
}

export function mealAt(
  planMeals: Meal[],
  day: DayOfWeek,
  slot: MealSlot,
  ): Meal | undefined {
  return planMeals.find((meal) => meal.day === day && meal.slot === slot);
}

export function dedupeLibraryMeals(): number {
  const db = getDb();
  const rows = db
    .select()
    .from(meals)
    .all()
    .map(mapMeal)
    .filter((meal) => !meal.draft && !meal.takeout);
  const buckets = new Map<string, Meal[]>();
  for (const meal of rows) {
    const key = normalizeTitle(meal.title);
    if (!key) continue;
    const list = buckets.get(key) ?? [];
    list.push(meal);
    buckets.set(key, list);
  }
  let removed = 0;
  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) => {
      const aLib = a.planId === "" ? 0 : 1;
      const bLib = b.planId === "" ? 0 : 1;
      if (aLib !== bLib) return aLib - bLib;
      if (Number(a.leftover) !== Number(b.leftover)) {
        return Number(a.leftover) - Number(b.leftover);
      }
      if (b.stars !== a.stars) return b.stars - a.stars;
      return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
    });
    const winner = ranked[0]!;
    for (const meal of ranked.slice(1)) {
      if (meal.planId !== "") continue;
      db.delete(meals).where(eq(meals.id, meal.id)).run();
      removed += 1;
    }
  }
  return removed;
}
