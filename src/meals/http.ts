import { z } from "zod";
import { createAdapter } from "@/ai/adapter";
import { getSettings } from "@/ai/settings-repo";
import { collectAllergies } from "@/ai/generate-plan";
import { getHousehold } from "@/household/repo";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { mondayOf } from "@/lib/week";
import type { AdapterRequest, AdapterResult, MealSlot } from "@/lib/types";
import { DAYS, RECIPE_SLOTS, SLOTS } from "@/lib/types";
import { hasAnySlot as maskHasAny } from "@/lib/slot-mask";
import {
  clearMealExtra,
  deleteMeal,
  deletePlan,
  updatePlan,
  fillEmptySlots,
  getCurrentPlan,
  getMeal,
  listLibraryMeals,
  openPlan,
  placeExtra,
  placeMeal,
  saveImportedMeal,
  saveLeftoverMeal,
  saveStandaloneMeal,
  saveTakeoutMeal,
  setMealStars,
  approveDraft,
  rejectDraft,
  setPinned,
  setPlanPinned,
  updateMeal,
} from "./repo";
import {
  mealEditSchema,
  parseSingleMealResponse,
  singleMealJsonSchema,
} from "./schema";

export type HttpResult = { status: number; body: unknown };

const slotEnum = z.enum(SLOTS as [MealSlot, ...MealSlot[]]);
const recipeSlotEnum = z.enum(RECIPE_SLOTS as [MealSlot, ...MealSlot[]]);
const dayEnum = z.enum(DAYS as [(typeof DAYS)[number], ...typeof DAYS]);

const placeBodySchema = z.object({
  sourceMealId: z.string().min(1),
  day: dayEnum,
  slot: slotEnum,
  weekStart: z.string().optional(),
});

const deleteBodySchema = z.object({
  mealId: z.string().min(1),
});

const deleteExtraBodySchema = z.object({
  mealId: z.string().min(1),
  kind: z.enum(["side", "dessert"]),
});

const placeExtraBodySchema = z.object({
  sourceMealId: z.string().min(1),
  mealId: z.string().min(1),
  kind: z.enum(["side", "dessert"]),
});

const deletePlanBodySchema = z.object({
  planId: z.string().min(1),
});

const updatePlanBodySchema = z.object({
  planId: z.string().min(1),
  name: z.string().max(60).optional(),
  favorited: z.boolean().optional(),
});

const pinBodySchema = z
  .object({
    mealId: z.string().min(1).optional(),
    planId: z.string().min(1).optional(),
    pinned: z.boolean(),
  })
  .refine((value) => Boolean(value.mealId) !== Boolean(value.planId), {
    message: "mealId or planId is required.",
  });

const slotFlagsSchema = z.object({
  breakfast: z.boolean(),
  lunch: z.boolean(),
  dinner: z.boolean(),
});

const slotMaskSchema = z.object({
  monday: slotFlagsSchema,
  tuesday: slotFlagsSchema,
  wednesday: slotFlagsSchema,
  thursday: slotFlagsSchema,
  friday: slotFlagsSchema,
  saturday: slotFlagsSchema,
  sunday: slotFlagsSchema,
});

const takeoutBodySchema = z.object({
  day: dayEnum,
  slot: slotEnum,
  title: z.string().optional(),
  weekStart: z.string().optional(),
});

const leftoverBodySchema = z.object({
  sourceMealId: z.string().min(1),
  day: dayEnum,
  slot: slotEnum,
});

const fillBodySchema = z.object({
  slotMask: slotMaskSchema,
  weekStart: z.string().optional(),
  planId: z.string().min(1).optional(),
  allowRepeats: z.boolean().optional().default(false),
  leftoverLunches: z.boolean().optional().default(false),
  maxProtein: z.number().int().min(0).max(21).optional().default(2),
});

const openPlanBodySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function jsonError(status: number, message: string): HttpResult {
  return { status, body: { message } };
}

export function handleListLibrary(slotRaw: string | null): HttpResult {
  const parsed = recipeSlotEnum.safeParse(slotRaw);
  if (!parsed.success) {
    return jsonError(400, "slot is required.");
  }
  return { status: 200, body: { meals: listLibraryMeals(parsed.data) } };
}

export function handleTakeoutMeal(body: unknown): HttpResult {
  const parsed = takeoutBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "day and slot are required.");
  const meal = saveTakeoutMeal({
    day: parsed.data.day,
    slot: parsed.data.slot,
    title: parsed.data.title,
    weekStart: parsed.data.weekStart ?? mondayOf(new Date()),
  });
  return { status: 200, body: { meal, plan: getCurrentPlan() } };
}

export function handleLeftoverMeal(body: unknown): HttpResult {
  const parsed = leftoverBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "sourceMealId, day, and slot are required.");
  }
  try {
    const meal = saveLeftoverMeal(parsed.data);
    return { status: 200, body: { meal, plan: getCurrentPlan() } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Couldn’t save leftovers.";
    if (message === "Meal not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

export function handleFillEmptySlots(body: unknown): HttpResult {
  const parsed = fillBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "slotMask is required.");
  if (!maskHasAny(parsed.data.slotMask)) {
    return jsonError(400, "Turn on at least one slot to fill.");
  }
  const household = getHousehold();
  const allergies = household ? collectAllergies(household) : [];
  const prefs = getKitchenPrefs();
  const plan = fillEmptySlots({
    planId: parsed.data.planId,
    weekStart: parsed.data.weekStart ?? mondayOf(new Date()),
    slotMask: parsed.data.slotMask,
    allowRepeats: parsed.data.allowRepeats,
    leftoverLunches: parsed.data.leftoverLunches,
    maxProtein: parsed.data.maxProtein,
    allergies,
    maxCookMinutes: prefs.maxCookMinutes,
  });
  return { status: 200, body: { plan } };
}

export function handleOpenPlan(body: unknown): HttpResult {
  const parsed = openPlanBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "weekStart is required.");
  return { status: 200, body: { plan: openPlan(parsed.data.weekStart) } };
}

export function handlePlaceMeal(body: unknown): HttpResult {
  const parsed = placeBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "sourceMealId, day, and slot are required.");
  }
  try {
    const meal = placeMeal({
      sourceMealId: parsed.data.sourceMealId,
      day: parsed.data.day,
      slot: parsed.data.slot,
      weekStart: parsed.data.weekStart ?? mondayOf(new Date()),
    });
    const plan = getCurrentPlan();
    return { status: 200, body: { meal, plan } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t place meal.";
    if (message === "Meal not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

export function handlePlaceExtra(body: unknown): HttpResult {
  const parsed = placeExtraBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "sourceMealId, mealId, and kind are required.");
  }
  try {
    const meal = placeExtra(parsed.data);
    return { status: 200, body: { meal, plan: getCurrentPlan() } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Couldn’t place that extra.";
    if (message === "Meal not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

const draftIdSchema = z.object({
  mealId: z.string().min(1),
});

const rateBodySchema = z.object({
  mealId: z.string().min(1),
  stars: z.number().int().min(0).max(5),
});

export function handleApproveDraft(body: unknown): HttpResult {
  const parsed = draftIdSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "mealId is required.");
  try {
    return { status: 200, body: { meal: approveDraft(parsed.data.mealId) } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t approve.";
    if (message === "Meal not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

export function handleRejectDraft(body: unknown): HttpResult {
  const parsed = draftIdSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "mealId is required.");
  try {
    rejectDraft(parsed.data.mealId);
    return { status: 200, body: { ok: true } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t reject.";
    if (message === "Meal not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

export function handleRateMeal(body: unknown): HttpResult {
  const parsed = rateBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "mealId and stars are required.");
  try {
    return {
      status: 200,
      body: { meal: setMealStars(parsed.data.mealId, parsed.data.stars) },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t rate.";
    if (message === "Meal not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

export function handleDeleteExtra(body: unknown): HttpResult {
  const parsed = deleteExtraBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "mealId and kind are required.");
  }
  const meal = getMeal(parsed.data.mealId);
  if (!meal) return jsonError(404, "Meal not found.");
  const current = getCurrentPlan();
  if (!current || meal.planId !== current.id) {
    return jsonError(400, "Sides and desserts can only be changed on this week.");
  }
  return { status: 200, body: { meal: clearMealExtra(meal.id, parsed.data.kind) } };
}

export function handleDeleteMeal(body: unknown): HttpResult {
  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "mealId is required.");
  }
  try {
    deleteMeal(parsed.data.mealId);
    return { status: 200, body: { ok: true, plan: getCurrentPlan() } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t delete meal.";
    if (message === "Meal not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

export function handleUpdatePlan(body: unknown): HttpResult {
  const parsed = updatePlanBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "planId is required.");
  }
  if (parsed.data.name === undefined && parsed.data.favorited === undefined) {
    return jsonError(400, "name or favorited is required.");
  }
  try {
    const plan = updatePlan(parsed.data);
    return { status: 200, body: { plan } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t update plan.";
    if (message === "Plan not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

export function handleDeletePlan(body: unknown): HttpResult {
  const parsed = deletePlanBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "planId is required.");
  }
  try {
    deletePlan(parsed.data.planId);
    return { status: 200, body: { ok: true, plan: getCurrentPlan() } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t delete plan.";
    if (message === "Plan not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

const importBodySchema = z.object({
  url: z.string().url(),
  slot: recipeSlotEnum,
});

export type ImportProgressEvent = { phase: string; message: string };

export async function handleImportRecipe(
  body: unknown,
  deps?: {
    complete?: (req: AdapterRequest) => Promise<AdapterResult>;
    onProgress?: (event: ImportProgressEvent) => void;
    signal?: AbortSignal;
  },
): Promise<HttpResult> {
  const parsed = importBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "A valid recipe URL and meal slot are required.");
  }

  const settings = getSettings();
  if (settings.mode === "grok" && !process.env.XAI_API_KEY && !deps?.complete) {
    return jsonError(
      400,
      "Add XAI_API_KEY in .env.local to import a recipe from a URL.",
    );
  }

  const messages = [
    {
      role: "system" as const,
      content:
        "Read the recipe at the given URL. Return one meal as JSON only. Copy title, ingredients with string quantities, cook time, method, and steps from the page. Do not invent amounts when the page lists them.",
    },
    {
      role: "user" as const,
      content: `Import this ${parsed.data.slot} recipe: ${parsed.data.url}`,
    },
  ];

  const adapter = deps?.complete
    ? { complete: deps.complete }
    : createAdapter({ ...settings, mode: "grok", webSearch: true });

  deps?.onProgress?.({ phase: "opening", message: "Opening the page" });

  const result = await adapter.complete({
    messages,
    jsonSchema: singleMealJsonSchema as unknown as Record<string, unknown>,
    schemaName: "single_meal",
    signal: deps?.signal,
  });
  if (!result.ok) {
    return jsonError(422, result.error || "Couldn’t import that recipe.");
  }

  deps?.onProgress?.({ phase: "writing", message: "Turning it into a meal" });

  const parsedMeal = parseSingleMealResponse(result.text);
  if (!parsedMeal.ok) {
    return jsonError(422, "Couldn’t get a usable recipe from that page.");
  }

  deps?.onProgress?.({ phase: "saving", message: "Saving the meal" });

  try {
    const meal = saveImportedMeal({
      meal: { ...parsedMeal.meal, slot: parsed.data.slot },
      slot: parsed.data.slot,
      sourceUrl: parsed.data.url,
      usedWebSearch: true,
    });
    return { status: 200, body: { meal } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Couldn’t save that recipe.";
    return jsonError(400, message);
  }
}

const updateBodySchema = mealEditSchema.extend({
  mealId: z.string().min(1),
});

const createBodySchema = mealEditSchema
  .omit({ whyItFits: true })
  .extend({
    slot: recipeSlotEnum,
    whyItFits: z.string().optional().default(""),
  });

export function handleCreateMeal(body: unknown): HttpResult {
  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Title, ingredients, and steps are required.");
  }
  const { slot, ...fields } = parsed.data;
  try {
    const meal = saveStandaloneMeal({
      meal: { ...fields, day: "monday", slot },
      slot,
    });
    return { status: 200, body: { meal } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Couldn’t save that recipe.";
    return jsonError(400, message);
  }
}

export function handleUpdateMeal(body: unknown): HttpResult {
  const parsed = updateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Title, ingredients, and steps are required.");
  }
  try {
    const { mealId, ...fields } = parsed.data;
    const meal = updateMeal(mealId, fields);
    return { status: 200, body: { meal, plan: getCurrentPlan() } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t update meal.";
    if (message === "Meal not found") return jsonError(404, message);
    return jsonError(400, message);
  }
}

export function handlePin(body: unknown): HttpResult {
  const parsed = pinBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "pinned and mealId or planId are required.");
  }
  try {
    if (parsed.data.mealId) {
      const meal = setPinned(parsed.data.mealId, parsed.data.pinned);
      return { status: 200, body: { meal } };
    }
    const plan = setPlanPinned(parsed.data.planId!, parsed.data.pinned);
    return { status: 200, body: { plan } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn’t update pin.";
    if (message === "Meal not found" || message === "Plan not found") {
      return jsonError(404, message);
    }
    return jsonError(400, message);
  }
}


