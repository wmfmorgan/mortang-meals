import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meals, weekPlans } from "@/lib/schema";
import type {
  DayOfWeek,
  GeneratedMeal,
  Ingredient,
  LibraryMeal,
  Meal,
  MealSlot,
  SlotMask,
  WeekPlan,
} from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { emptySlotMask } from "@/lib/slot-mask";
import { mondayOf } from "@/lib/week";
import { normalizeTitle } from "./duplicates";

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
    sourceUrl: extras.sourceUrl ?? null,
  };
}

export function listPlans(): Pick<WeekPlan, "id" | "weekStart" | "isCurrent">[] {
  const db = getDb();
  return db
    .select()
    .from(weekPlans)
    .all()
    .map((row) => ({
      id: row.id,
      weekStart: row.weekStart,
      isCurrent: row.isCurrent === 1,
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
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function saveImportedMeal(input: {
  meal: GeneratedMeal;
  slot: MealSlot;
  sourceUrl: string;
  usedWebSearch?: boolean;
}): Meal {
  const db = getDb();
  const weekStart = mondayOf(new Date());
  const row = mealInsertValues(
    "",
    { ...input.meal, day: "monday", slot: input.slot },
    {
      usedWebSearch: input.usedWebSearch === true ? 1 : 0,
      pinned: 0,
      weekStart,
      sourceUrl: input.sourceUrl,
    },
  );
  db.insert(meals).values(row).run();
  return mapMeal(row);
}

export function getMeal(id: string): Meal | null {
  const db = getDb();
  const row = db.select().from(meals).where(eq(meals.id, id)).get();
  return row ? mapMeal(row) : null;
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
    sourceUrl: existing.sourceUrl,
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
  const current = getCurrentPlan();
  if (current) return current;
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
