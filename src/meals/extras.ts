import { z } from "zod";
import type { Aisle, ExtraKind, MealExtra, MealExtras } from "@/lib/types";
import { AISLES } from "@/lib/types";

export const EMPTY_EXTRAS: MealExtras = { side: null, dessert: null };

const aisleEnum = z.enum(AISLES as [Aisle, ...Aisle[]]);

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.string().min(1),
  unit: z.string().min(1),
  aisle: aisleEnum,
});

const extraKindSchema = z.enum(["side", "dessert"]);
const extraModeSchema = z.enum(["suggestion", "recipe"]);

const mealExtraSchema = z.object({
  id: z.string().min(1),
  kind: extraKindSchema,
  mode: extraModeSchema,
  title: z.string().min(1),
  whyItFits: z.string(),
  cookMinutes: z.number().int().nonnegative(),
  method: z.string(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string()),
  usedWebSearch: z.boolean(),
  sourceUrl: z.union([z.string(), z.null()]),
});

function parseOne(
  raw: unknown,
  expectedKind: ExtraKind,
): MealExtra | null {
  const parsed = mealExtraSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.kind !== expectedKind) return null;
  return parsed.data;
}

export function parseMealExtras(raw: unknown): MealExtras {
  if (raw == null || raw === "") return EMPTY_EXTRAS;
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return EMPTY_EXTRAS;
    }
  }
  if (!value || typeof value !== "object") return EMPTY_EXTRAS;
  const record = value as { side?: unknown; dessert?: unknown };
  return {
    side: parseOne(record.side, "side"),
    dessert: parseOne(record.dessert, "dessert"),
  };
}

export function extraFromMeal(
  meal: {
    id: string;
    title: string;
    whyItFits: string;
    cookMinutes: number;
    method: string;
    ingredients: MealExtra["ingredients"];
    steps: string[];
    usedWebSearch: boolean;
    sourceUrl: string | null;
  },
  kind: ExtraKind,
): MealExtra {
  return {
    id: meal.id,
    kind,
    mode: "recipe",
    title: meal.title,
    whyItFits: meal.whyItFits,
    cookMinutes: meal.cookMinutes,
    method: meal.method,
    ingredients: meal.ingredients,
    steps: meal.steps,
    usedWebSearch: meal.usedWebSearch,
    sourceUrl: meal.sourceUrl,
  };
}

export function suggestionExtra(input: {
  id: string;
  kind: ExtraKind;
  title: string;
}): MealExtra {
  return {
    id: input.id,
    kind: input.kind,
    mode: "suggestion",
    title: input.title,
    whyItFits: "",
    cookMinutes: 0,
    method: "",
    ingredients: [],
    steps: [],
    usedWebSearch: false,
    sourceUrl: null,
  };
}
