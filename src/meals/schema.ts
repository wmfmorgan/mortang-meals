import { z } from "zod";
import type { Aisle, DayOfWeek, GeneratedMeal, MealSlot } from "@/lib/types";
import { AISLES, DAYS, SLOTS } from "@/lib/types";

const dayEnum = z.enum(DAYS as [DayOfWeek, ...DayOfWeek[]]);
const slotEnum = z.enum(SLOTS as [MealSlot, ...MealSlot[]]);
const aisleEnum = z.enum(AISLES as [Aisle, ...Aisle[]]);

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  aisle: aisleEnum,
});

export const mealSchema = z.object({
  day: dayEnum,
  slot: slotEnum,
  title: z.string().min(1),
  whyItFits: z.string().min(1),
  cookMinutes: z.number().int().positive(),
  method: z.string().min(1),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(z.string().min(1)).min(1),
});

export const mealsResponseSchema = z.object({
  meals: z.array(mealSchema),
});

export const singleMealResponseSchema = z.object({
  meal: mealSchema,
});

type ParseFail = { ok: false; reason: "invalid-json" | "schema" };

export function parseMealsResponse(
  text: string,
): { ok: true; meals: GeneratedMeal[] } | ParseFail {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  const parsed = mealsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "schema" };
  }
  return { ok: true, meals: parsed.data.meals };
}

export function parseSingleMealResponse(
  text: string,
): { ok: true; meal: GeneratedMeal } | ParseFail {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  const parsed = singleMealResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "schema" };
  }
  return { ok: true, meal: parsed.data.meal };
}

const mealJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "day",
    "slot",
    "title",
    "whyItFits",
    "cookMinutes",
    "method",
    "ingredients",
    "steps",
  ],
  properties: {
    day: { type: "string", enum: [...DAYS] },
    slot: { type: "string", enum: [...SLOTS] },
    title: { type: "string", minLength: 1 },
    whyItFits: { type: "string", minLength: 1 },
    cookMinutes: { type: "integer", exclusiveMinimum: 0 },
    method: { type: "string", minLength: 1 },
    ingredients: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "unit", "aisle"],
        properties: {
          name: { type: "string", minLength: 1 },
          quantity: { type: "number", minimum: 0 },
          unit: { type: "string", minLength: 1 },
          aisle: { type: "string", enum: [...AISLES] },
        },
      },
    },
    steps: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
  },
} as const;

export const mealsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["meals"],
  properties: {
    meals: {
      type: "array",
      items: mealJsonSchema,
    },
  },
} as const;

export const singleMealJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["meal"],
  properties: {
    meal: mealJsonSchema,
  },
} as const;
