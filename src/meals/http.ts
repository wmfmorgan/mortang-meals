import { z } from "zod";
import { createAdapter } from "@/ai/adapter";
import { getSettings } from "@/ai/settings-repo";
import { mondayOf } from "@/lib/week";
import type { AdapterRequest, AdapterResult, MealSlot } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import {
  deleteMeal,
  deletePlan,
  getCurrentPlan,
  listLibraryMeals,
  placeMeal,
  saveImportedMeal,
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

const deletePlanBodySchema = z.object({
  planId: z.string().min(1),
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

function jsonError(status: number, message: string): HttpResult {
  return { status, body: { message } };
}

export function handleListLibrary(slotRaw: string | null): HttpResult {
  const parsed = slotEnum.safeParse(slotRaw);
  if (!parsed.success) {
    return jsonError(400, "slot is required.");
  }
  return { status: 200, body: { meals: listLibraryMeals(parsed.data) } };
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
  slot: slotEnum,
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

  const meal = saveImportedMeal({
    meal: { ...parsedMeal.meal, slot: parsed.data.slot },
    slot: parsed.data.slot,
    sourceUrl: parsed.data.url,
    usedWebSearch: true,
  });
  return { status: 200, body: { meal } };
}

const updateBodySchema = mealEditSchema.extend({
  mealId: z.string().min(1),
});

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


