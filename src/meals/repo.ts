import { and, eq } from "drizzle-orm";
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
    ingredients: row.ingredients,
    steps: row.steps,
    usedWebSearch: row.usedWebSearch,
    pinned: row.pinned,
    createdAt: row.createdAt,
    sourceUrl: row.sourceUrl,
    extras: parseMealExtras(row.extras),
    draft: row.draft,
    stars: row.stars,
    takeout: row.takeout,
    leftover: row.leftover,
  };
}

function sortMeals(items: Meal[]): Meal[] {
  return [...items].sort((a, b) => {
    const dayDelta = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDelta !== 0) return dayDelta;
    return SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot);
  });
}

async function loadMeals(householdId: string, planId: string): Promise<Meal[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(meals)
    .where(and(eq(meals.householdId, householdId), eq(meals.planId, planId)));
  return sortMeals(rows.map(mapMeal));
}

async function loadMealRow(
  householdId: string,
  id: string,
): Promise<MealRow | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(meals)
    .where(and(eq(meals.householdId, householdId), eq(meals.id, id)))
    .limit(1);
  return row;
}

function mapPlan(row: PlanRow, planMeals: Meal[]): WeekPlan {
  return {
    id: row.id,
    weekStart: row.weekStart,
    isCurrent: row.isCurrent,
    slotMask: row.slotMask,
    meals: planMeals,
    name: row.name ?? "",
    favorited: row.favorited,
  };
}

function mealInsertValues(
  householdId: string,
  planId: string | null,
  meal: GeneratedMeal,
  extras: {
    usedWebSearch: boolean;
    pinned: boolean;
    weekStart: string;
    createdAt?: string;
    sourceUrl?: string | null;
    id?: string;
    extras?: MealExtras;
    draft?: boolean;
    stars?: number;
    takeout?: boolean;
    leftover?: boolean;
  },
) {
  return {
    id: extras.id ?? crypto.randomUUID(),
    householdId,
    planId,
    day: meal.day,
    slot: meal.slot,
    title: meal.title,
    whyItFits: meal.whyItFits,
    cookMinutes: meal.cookMinutes,
    method: meal.method,
    ingredients: meal.ingredients,
    steps: meal.steps,
    usedWebSearch: extras.usedWebSearch,
    pinned: extras.pinned,
    weekStart: extras.weekStart,
    createdAt: extras.createdAt ?? new Date().toISOString(),
    sourceUrl: extras.sourceUrl ?? meal.sourceUrl ?? null,
    extras: extras.extras ?? EMPTY_EXTRAS,
    draft: extras.draft ?? false,
    stars: extras.stars ?? 0,
    takeout: extras.takeout ?? false,
    leftover: extras.leftover ?? false,
  };
}

export async function listPlans(
  householdId: string,
): Promise<
  Pick<WeekPlan, "id" | "weekStart" | "isCurrent" | "name" | "favorited">[]
> {
  const db = getDb();
  const rows = await db
    .select()
    .from(weekPlans)
    .where(eq(weekPlans.householdId, householdId));
  return rows
    .map((row) => ({
      id: row.id,
      weekStart: row.weekStart,
      isCurrent: row.isCurrent,
      name: row.name ?? "",
      favorited: row.favorited,
    }))
    .sort((a, b) => {
      const weekDelta = b.weekStart.localeCompare(a.weekStart);
      if (weekDelta !== 0) return weekDelta;
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.id.localeCompare(a.id);
    });
}

export async function getPlan(
  householdId: string,
  id: string,
): Promise<WeekPlan | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(weekPlans)
    .where(and(eq(weekPlans.householdId, householdId), eq(weekPlans.id, id)))
    .limit(1);
  if (!row) return null;
  return mapPlan(row, await loadMeals(householdId, row.id));
}

export async function getCurrentPlan(
  householdId: string,
): Promise<WeekPlan | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(weekPlans)
    .where(
      and(eq(weekPlans.householdId, householdId), eq(weekPlans.isCurrent, true)),
    )
    .limit(1);
  if (!row) return null;
  return mapPlan(row, await loadMeals(householdId, row.id));
}

export async function listAllMeals(householdId: string): Promise<Meal[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(meals)
    .where(eq(meals.householdId, householdId));
  return rows
    .map(mapMeal)
    .filter((meal) => !meal.draft)
    .sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
}

export async function listCatalogMeals(householdId: string): Promise<Meal[]> {
  return uniqueCatalogMeals(await listAllMeals(householdId));
}

export async function titleTaken(
  householdId: string,
  title: string,
  exceptId?: string,
): Promise<boolean> {
  return (await listCatalogMeals(householdId)).some(
    (meal) => meal.id !== exceptId && isDuplicateTitle(meal.title, [title]),
  );
}

export async function listDraftMeals(householdId: string): Promise<Meal[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(meals)
    .where(eq(meals.householdId, householdId));
  return rows
    .map(mapMeal)
    .filter((meal) => meal.draft)
    .sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
}

export async function saveStandaloneMeal(
  householdId: string,
  input: {
    meal: GeneratedMeal;
    slot: MealSlot;
    sourceUrl?: string | null;
    usedWebSearch?: boolean;
    draft?: boolean;
  },
): Promise<Meal> {
  if (input.draft !== true && (await titleTaken(householdId, input.meal.title))) {
    throw new Error("That recipe is already in the library.");
  }
  const db = getDb();
  const weekStart = mondayOf(new Date());
  const values = mealInsertValues(
    householdId,
    null,
    { ...input.meal, day: "monday", slot: input.slot },
    {
      usedWebSearch: input.usedWebSearch === true,
      pinned: false,
      weekStart,
      sourceUrl: input.sourceUrl ?? null,
      draft: input.draft === true,
    },
  );
  const [row] = await db.insert(meals).values(values).returning();
  if (!row) throw new Error("Meal insert failed");
  return mapMeal(row);
}

export async function saveDraftMeals(
  householdId: string,
  items: Array<{
    meal: GeneratedMeal;
    slot: MealSlot;
    usedWebSearch?: boolean;
  }>,
): Promise<Meal[]> {
  const saved: Meal[] = [];
  for (const item of items) {
    saved.push(await saveStandaloneMeal(householdId, { ...item, draft: true }));
  }
  return saved;
}

export async function approveDraft(
  householdId: string,
  mealId: string,
): Promise<Meal> {
  const existing = await loadMealRow(householdId, mealId);
  if (!existing) throw new Error("Meal not found");
  if (!existing.draft) throw new Error("Not a draft");
  if (await titleTaken(householdId, existing.title, existing.id)) {
    throw new Error("That recipe is already in the library.");
  }
  const [row] = await getDb()
    .update(meals)
    .set({ draft: false })
    .where(and(eq(meals.householdId, householdId), eq(meals.id, mealId)))
    .returning();
  if (!row) throw new Error("Meal not found");
  return mapMeal(row);
}

export async function rejectDraft(
  householdId: string,
  mealId: string,
): Promise<void> {
  const existing = await getMeal(householdId, mealId);
  if (!existing) throw new Error("Meal not found");
  if (!existing.draft) throw new Error("Not a draft");
  await deleteMeal(householdId, mealId);
}

export async function setMealStars(
  householdId: string,
  mealId: string,
  stars: number,
): Promise<Meal> {
  if (!Number.isInteger(stars) || stars < 0 || stars > 5) {
    throw new Error("Stars must be 0 through 5.");
  }
  const existing = await loadMealRow(householdId, mealId);
  if (!existing) throw new Error("Meal not found");
  if (existing.draft) throw new Error("Drafts cannot be rated.");
  const [row] = await getDb()
    .update(meals)
    .set({ stars })
    .where(and(eq(meals.householdId, householdId), eq(meals.id, mealId)))
    .returning();
  if (!row) throw new Error("Meal not found");
  return mapMeal(row);
}

export async function saveImportedMeal(
  householdId: string,
  input: {
    meal: GeneratedMeal;
    slot: MealSlot;
    sourceUrl: string;
    usedWebSearch?: boolean;
  },
): Promise<Meal> {
  return saveStandaloneMeal(householdId, input);
}

export async function getMeal(
  householdId: string,
  id: string,
): Promise<Meal | null> {
  const row = await loadMealRow(householdId, id);
  return row ? mapMeal(row) : null;
}

export async function setMealExtra(
  householdId: string,
  mealId: string,
  extra: MealExtra,
): Promise<Meal> {
  const existing = await loadMealRow(householdId, mealId);
  if (!existing) throw new Error("Meal not found");
  const extras = {
    ...parseMealExtras(existing.extras),
    [extra.kind]: extra,
  };
  const [row] = await getDb()
    .update(meals)
    .set({ extras })
    .where(and(eq(meals.householdId, householdId), eq(meals.id, mealId)))
    .returning();
  if (!row) throw new Error("Meal not found");
  return mapMeal(row);
}

export async function placeExtra(
  householdId: string,
  input: {
    sourceMealId: string;
    mealId: string;
    kind: ExtraKind;
  },
): Promise<Meal> {
  const source = await getMeal(householdId, input.sourceMealId);
  if (!source) throw new Error("Meal not found");
  if (source.draft) throw new Error("Meal not found");
  const parent = await getMeal(householdId, input.mealId);
  if (!parent) throw new Error("Meal not found");
  const current = await getCurrentPlan(householdId);
  if (!current || parent.planId !== current.id) {
    throw new Error("Sides and desserts can only be added on this week.");
  }
  if (parent.slot !== "lunch" && parent.slot !== "dinner") {
    throw new Error("Breakfasts don’t have sides or desserts.");
  }
  if (parent.extras[input.kind]) {
    throw new Error(`That meal already has a ${input.kind}.`);
  }
  return setMealExtra(householdId, parent.id, extraFromMeal(source, input.kind));
}

export async function clearMealExtra(
  householdId: string,
  mealId: string,
  kind: ExtraKind,
): Promise<Meal> {
  const existing = await loadMealRow(householdId, mealId);
  if (!existing) throw new Error("Meal not found");
  const extras = {
    ...parseMealExtras(existing.extras),
    [kind]: null,
  };
  const [row] = await getDb()
    .update(meals)
    .set({ extras })
    .where(and(eq(meals.householdId, householdId), eq(meals.id, mealId)))
    .returning();
  if (!row) throw new Error("Meal not found");
  return mapMeal(row);
}

export async function updateMeal(
  householdId: string,
  id: string,
  fields: {
    title: string;
    whyItFits: string;
    cookMinutes: number;
    method: string;
    ingredients: Ingredient[];
    steps: string[];
  },
): Promise<Meal> {
  const existing = await loadMealRow(householdId, id);
  if (!existing) throw new Error("Meal not found");
  if (await titleTaken(householdId, fields.title, id)) {
    throw new Error("That recipe is already in the library.");
  }
  const [row] = await getDb()
    .update(meals)
    .set({
      title: fields.title,
      whyItFits: fields.whyItFits,
      cookMinutes: fields.cookMinutes,
      method: fields.method,
      ingredients: fields.ingredients,
      steps: fields.steps,
    })
    .where(and(eq(meals.householdId, householdId), eq(meals.id, id)))
    .returning();
  if (!row) throw new Error("Meal not found");
  return mapMeal(row);
}

export async function saveGeneratedPlan(
  householdId: string,
  input: {
    weekStart: string;
    slotMask: SlotMask;
    meals: GeneratedMeal[];
    usedWebSearch?: boolean;
  },
): Promise<WeekPlan> {
  const db = getDb();
  const planId = crypto.randomUUID();
  const usedWebSearch = input.usedWebSearch === true;
  const mealRows = input.meals.map((meal) =>
    mealInsertValues(householdId, planId, meal, {
      usedWebSearch,
      pinned: false,
      weekStart: input.weekStart,
    }),
  );

  await db.transaction(async (tx) => {
    await tx
      .update(weekPlans)
      .set({ isCurrent: false })
      .where(eq(weekPlans.householdId, householdId));
    await tx.insert(weekPlans).values({
      id: planId,
      householdId,
      weekStart: input.weekStart,
      isCurrent: true,
      slotMask: input.slotMask,
      name: "",
      favorited: false,
    });
    if (mealRows.length > 0) {
      await tx.insert(meals).values(mealRows);
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

export async function mergeGeneratedPlan(
  householdId: string,
  input: {
    weekStart: string;
    slotMask: SlotMask;
    meals: GeneratedMeal[];
    usedWebSearch?: boolean;
  },
): Promise<WeekPlan> {
  const current = await getCurrentPlan(householdId);
  if (!current) {
    return saveGeneratedPlan(householdId, input);
  }

  const db = getDb();
  const usedWebSearch = input.usedWebSearch === true;
  const incoming = input.meals;

  await db.transaction(async (tx) => {
    await tx
      .update(weekPlans)
      .set({ slotMask: input.slotMask })
      .where(
        and(eq(weekPlans.householdId, householdId), eq(weekPlans.id, current.id)),
      );

    for (const next of incoming) {
      const existing = current.meals.find(
        (meal) => meal.day === next.day && meal.slot === next.slot,
      );
      if (existing?.pinned) continue;

      if (existing) {
        await tx
          .delete(meals)
          .where(
            and(eq(meals.householdId, householdId), eq(meals.id, existing.id)),
          );
      }
      await tx.insert(meals).values(
        mealInsertValues(householdId, current.id, next, {
          usedWebSearch,
          pinned: false,
          weekStart: current.weekStart,
        }),
      );
    }
  });

  return (await getPlan(householdId, current.id)) ?? current;
}

export async function replaceMeal(
  householdId: string,
  planId: string,
  mealId: string,
  next: GeneratedMeal,
  usedWebSearch = false,
): Promise<Meal> {
  const existing = await loadMealRow(householdId, mealId);
  if (!existing || existing.planId !== planId) {
    throw new Error("Meal not found");
  }

  const values = mealInsertValues(householdId, planId, next, {
    id: mealId,
    usedWebSearch,
    pinned: existing.pinned,
    weekStart: existing.weekStart,
    createdAt: existing.createdAt,
    sourceUrl: next.sourceUrl ?? null,
    extras: parseMealExtras(existing.extras),
    draft: existing.draft,
    stars: existing.stars,
  });
  const [row] = await getDb()
    .update(meals)
    .set(values)
    .where(and(eq(meals.householdId, householdId), eq(meals.id, mealId)))
    .returning();
  if (!row) throw new Error("Meal not found");
  return mapMeal(row);
}

export async function listLibraryMeals(
  householdId: string,
  slot: MealSlot,
): Promise<LibraryMeal[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(meals)
    .where(and(eq(meals.householdId, householdId), eq(meals.slot, slot)));

  rows.sort((a, b) => {
    const weekDelta = b.weekStart.localeCompare(a.weekStart);
    if (weekDelta !== 0) return weekDelta;
    return b.id.localeCompare(a.id);
  });

  const seen = new Set<string>();
  const unique: LibraryMeal[] = [];
  for (const row of rows) {
    if (row.draft || row.takeout) continue;
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
      usedWebSearch: row.usedWebSearch,
    });
  }
  return unique;
}

export async function ensureCurrentPlan(
  householdId: string,
  weekStart: string,
): Promise<WeekPlan> {
  return openPlan(householdId, weekStart);
}

/** Open a specific plan, or this calendar week if current is in the past. */
export async function resolveOpenPlan(
  householdId: string,
  planId?: string,
  today: Date = new Date(),
): Promise<WeekPlan> {
  if (planId) {
    const requested = await getPlan(householdId, planId);
    if (requested) return requested;
  }
  const thisMonday = mondayOf(today);
  const current = await getCurrentPlan(householdId);
  if (current && current.weekStart >= thisMonday) return current;
  return openPlan(householdId, thisMonday);
}

export async function openPlan(
  householdId: string,
  weekStart: string,
): Promise<WeekPlan> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(weekPlans)
    .where(
      and(
        eq(weekPlans.householdId, householdId),
        eq(weekPlans.weekStart, weekStart),
      ),
    )
    .limit(1);
  if (existing) {
    await db.transaction(async (tx) => {
      await tx
        .update(weekPlans)
        .set({ isCurrent: false })
        .where(eq(weekPlans.householdId, householdId));
      await tx
        .update(weekPlans)
        .set({ isCurrent: true })
        .where(
          and(
            eq(weekPlans.householdId, householdId),
            eq(weekPlans.id, existing.id),
          ),
        );
    });
    return (await getPlan(householdId, existing.id))!;
  }
  return saveGeneratedPlan(householdId, {
    weekStart,
    slotMask: emptySlotMask(),
    meals: [],
  });
}

export async function placeMeal(
  householdId: string,
  input: {
    sourceMealId: string;
    day: DayOfWeek;
    slot: MealSlot;
    weekStart: string;
  },
): Promise<Meal> {
  const source = await getMeal(householdId, input.sourceMealId);
  if (!source) throw new Error("Meal not found");
  if (source.draft) throw new Error("Meal not found");

  const plan = await ensureCurrentPlan(householdId, input.weekStart);
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
  const usedWebSearch = source.usedWebSearch;

  if (occupant) {
    const values = mealInsertValues(householdId, plan.id, copy, {
      id: occupant.id,
      usedWebSearch,
      pinned: occupant.pinned,
      weekStart: plan.weekStart,
      sourceUrl: source.sourceUrl,
    });
    const [row] = await getDb()
      .update(meals)
      .set(values)
      .where(and(eq(meals.householdId, householdId), eq(meals.id, occupant.id)))
      .returning();
    if (!row) throw new Error("Meal update failed");
    return mapMeal(row);
  }

  const values = mealInsertValues(householdId, plan.id, copy, {
    usedWebSearch,
    pinned: false,
    weekStart: plan.weekStart,
    sourceUrl: source.sourceUrl,
  });
  const [row] = await getDb().insert(meals).values(values).returning();
  if (!row) throw new Error("Meal insert failed");
  return mapMeal(row);
}

async function copyOntoPlan(
  householdId: string,
  input: {
    source: Meal;
    day: DayOfWeek;
    slot: MealSlot;
    leftover: boolean;
    weekStart: string;
    planId?: string;
  },
): Promise<Meal> {
  const plan = input.planId
    ? await getPlan(householdId, input.planId)
    : await openPlan(householdId, input.weekStart);
  if (!plan) throw new Error("Plan not found");
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
    usedWebSearch: input.source.usedWebSearch,
    pinned: occupant?.pinned ?? false,
    weekStart: plan.weekStart,
    sourceUrl: input.source.sourceUrl,
    leftover: input.leftover,
    takeout: false,
  };
  if (occupant) {
    const values = mealInsertValues(householdId, plan.id, copy, {
      ...extras,
      id: occupant.id,
    });
    const [row] = await getDb()
      .update(meals)
      .set(values)
      .where(and(eq(meals.householdId, householdId), eq(meals.id, occupant.id)))
      .returning();
    if (!row) throw new Error("Meal update failed");
    return mapMeal(row);
  }
  const values = mealInsertValues(householdId, plan.id, copy, extras);
  const [row] = await getDb().insert(meals).values(values).returning();
  if (!row) throw new Error("Meal insert failed");
  return mapMeal(row);
}

export async function saveTakeoutMeal(
  householdId: string,
  input: {
    day: DayOfWeek;
    slot: MealSlot;
    title?: string;
    weekStart: string;
  },
): Promise<Meal> {
  const plan = await openPlan(householdId, input.weekStart);
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
    usedWebSearch: false,
    pinned: occupant?.pinned ?? false,
    weekStart: plan.weekStart,
    sourceUrl: null as string | null,
    takeout: true,
    leftover: false,
    extras: EMPTY_EXTRAS,
  };
  if (occupant) {
    const values = mealInsertValues(householdId, plan.id, generated, {
      ...extras,
      id: occupant.id,
    });
    const [row] = await getDb()
      .update(meals)
      .set(values)
      .where(and(eq(meals.householdId, householdId), eq(meals.id, occupant.id)))
      .returning();
    if (!row) throw new Error("Meal update failed");
    return mapMeal(row);
  }
  const values = mealInsertValues(householdId, plan.id, generated, extras);
  const [row] = await getDb().insert(meals).values(values).returning();
  if (!row) throw new Error("Meal insert failed");
  return mapMeal(row);
}

export async function saveLeftoverMeal(
  householdId: string,
  input: {
    sourceMealId: string;
    day: DayOfWeek;
    slot: MealSlot;
  },
): Promise<Meal> {
  const source = await getMeal(householdId, input.sourceMealId);
  if (!source) throw new Error("Meal not found");
  if (source.takeout) throw new Error("Takeout cannot be leftovers.");
  const current = await getCurrentPlan(householdId);
  if (!current || source.planId !== current.id) {
    throw new Error("Leftovers can only be copied from this week.");
  }
  return copyOntoPlan(householdId, {
    source,
    day: input.day,
    slot: input.slot,
    leftover: true,
    weekStart: current.weekStart,
  });
}

export async function fillEmptySlots(
  householdId: string,
  input: {
    weekStart: string;
    planId?: string;
    slotMask: SlotMask;
    allowRepeats: boolean;
    leftoverLunches: boolean;
    maxProtein: number;
    allergies: string[];
    maxCookMinutes: number;
  },
): Promise<WeekPlan> {
  const plan = input.planId
    ? ((await getPlan(householdId, input.planId)) ??
      (await openPlan(householdId, input.weekStart)))
    : await openPlan(householdId, input.weekStart);
  await getDb()
    .update(weekPlans)
    .set({ slotMask: input.slotMask })
    .where(and(eq(weekPlans.householdId, householdId), eq(weekPlans.id, plan.id)));

  const picks = pickFillMeals({
    mask: input.slotMask,
    occupied: plan.meals,
    library: await listCatalogMeals(householdId),
    allergies: input.allergies,
    maxCookMinutes: input.maxCookMinutes,
    allowRepeats: input.allowRepeats,
    leftoverLunches: input.leftoverLunches,
    maxProtein: input.maxProtein,
  });

  for (const pick of picks) {
    await copyOntoPlan(householdId, {
      source: pick.source,
      day: pick.day,
      slot: pick.slot,
      leftover: pick.leftover,
      weekStart: plan.weekStart,
      planId: plan.id,
    });
  }
  return (await getPlan(householdId, plan.id)) ?? plan;
}

export async function updatePlan(
  householdId: string,
  input: {
    planId: string;
    name?: string;
    favorited?: boolean;
  },
): Promise<WeekPlan> {
  const existing = await getPlan(householdId, input.planId);
  if (!existing) throw new Error("Plan not found");
  const patch: { name?: string; favorited?: boolean } = {};
  if (input.name !== undefined) {
    patch.name = input.name.trim().slice(0, 60);
  }
  if (input.favorited !== undefined) {
    patch.favorited = input.favorited;
  }
  if (Object.keys(patch).length > 0) {
    await getDb()
      .update(weekPlans)
      .set(patch)
      .where(
        and(eq(weekPlans.householdId, householdId), eq(weekPlans.id, input.planId)),
      );
  }
  return (await getPlan(householdId, input.planId))!;
}

export async function deletePlan(
  householdId: string,
  planId: string,
): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(weekPlans)
    .where(and(eq(weekPlans.householdId, householdId), eq(weekPlans.id, planId)))
    .limit(1);
  if (!existing) throw new Error("Plan not found");
  await db
    .delete(weekPlans)
    .where(and(eq(weekPlans.householdId, householdId), eq(weekPlans.id, planId)));
}

export async function deleteMeal(
  householdId: string,
  mealId: string,
): Promise<void> {
  const existing = await loadMealRow(householdId, mealId);
  if (!existing) throw new Error("Meal not found");
  await getDb()
    .delete(meals)
    .where(and(eq(meals.householdId, householdId), eq(meals.id, mealId)));
}

export async function setPinned(
  householdId: string,
  mealId: string,
  pinned: boolean,
): Promise<Meal> {
  const existing = await loadMealRow(householdId, mealId);
  if (!existing) throw new Error("Meal not found");
  const [row] = await getDb()
    .update(meals)
    .set({ pinned })
    .where(and(eq(meals.householdId, householdId), eq(meals.id, mealId)))
    .returning();
  if (!row) throw new Error("Meal not found");
  return mapMeal(row);
}

export async function setPlanPinned(
  householdId: string,
  planId: string,
  pinned: boolean,
): Promise<WeekPlan> {
  const plan = await getPlan(householdId, planId);
  if (!plan) throw new Error("Plan not found");
  await getDb()
    .update(meals)
    .set({ pinned })
    .where(and(eq(meals.householdId, householdId), eq(meals.planId, planId)));
  return (await getPlan(householdId, planId)) ?? plan;
}

export function mealAt(
  planMeals: Meal[],
  day: DayOfWeek,
  slot: MealSlot,
): Meal | undefined {
  return planMeals.find((meal) => meal.day === day && meal.slot === slot);
}

export async function dedupeLibraryMeals(householdId: string): Promise<number> {
  const db = getDb();
  const rows = (
    await db.select().from(meals).where(eq(meals.householdId, householdId))
  )
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
      const aLib = a.planId == null ? 0 : 1;
      const bLib = b.planId == null ? 0 : 1;
      if (aLib !== bLib) return aLib - bLib;
      if (Number(a.leftover) !== Number(b.leftover)) {
        return Number(a.leftover) - Number(b.leftover);
      }
      if (b.stars !== a.stars) return b.stars - a.stars;
      return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
    });
    for (const meal of ranked.slice(1)) {
      if (meal.planId != null) continue;
      await db
        .delete(meals)
        .where(and(eq(meals.householdId, householdId), eq(meals.id, meal.id)));
      removed += 1;
    }
  }
  return removed;
}
