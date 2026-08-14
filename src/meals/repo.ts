import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meals, weekPlans } from "@/lib/schema";
import type {
  GeneratedMeal,
  Ingredient,
  Meal,
  SlotMask,
  WeekPlan,
} from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";

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

export function saveGeneratedPlan(input: {
  weekStart: string;
  slotMask: SlotMask;
  meals: GeneratedMeal[];
  usedWebSearch?: boolean;
}): WeekPlan {
  const db = getDb();
  const planId = crypto.randomUUID();
  const usedWebSearch = input.usedWebSearch === true ? 1 : 0;
  const mealRows = input.meals.map((meal) => ({
    id: crypto.randomUUID(),
    planId,
    day: meal.day,
    slot: meal.slot,
    title: meal.title,
    whyItFits: meal.whyItFits,
    cookMinutes: meal.cookMinutes,
    method: meal.method,
    ingredientsJson: JSON.stringify(meal.ingredients),
    stepsJson: JSON.stringify(meal.steps),
    usedWebSearch,
  }));

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

  const row = {
    planId,
    day: next.day,
    slot: next.slot,
    title: next.title,
    whyItFits: next.whyItFits,
    cookMinutes: next.cookMinutes,
    method: next.method,
    ingredientsJson: JSON.stringify(next.ingredients),
    stepsJson: JSON.stringify(next.steps),
    usedWebSearch: usedWebSearch ? 1 : 0,
  };
  db.update(meals).set(row).where(eq(meals.id, mealId)).run();
  return mapMeal({ id: mealId, ...row });
}
