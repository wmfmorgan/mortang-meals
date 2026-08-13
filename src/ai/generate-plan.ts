import { buildHouseholdBrief } from "@/household/brief";
import { findAllergen } from "@/meals/allergen";
import { isDuplicateTitle } from "@/meals/duplicates";
import { mealsJsonSchema, parseMealsResponse } from "@/meals/schema";
import type {
  AdapterRequest,
  AdapterResult,
  AiSettings,
  AiTrace,
  DayOfWeek,
  GeneratedMeal,
  Household,
  KitchenItem,
  MealSlot,
  SlotMask,
  TraceKind,
  ValidationResult,
} from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";

export type PlanFailure = { ok: false; message: string };
export type GenerateSuccess = { ok: true; meals: GeneratedMeal[] };

const NO_SLOTS = "Turn on at least one meal slot.";
const TRANSPORT_FAIL = "The model didn’t respond";
const UNUSABLE_PLAN = "Couldn’t get a usable plan, try again.";

const HARD_RULES = [
  "Fill only the requested slots.",
  "Use the household servings.",
  "Never include ingredients that match any allergy.",
  "Honor avoidances.",
  "Respond with JSON only.",
  "No duplicate titles inside the plan.",
].join("\n");

export function collectAllergies(household: Household): string[] {
  return household.people.flatMap((person) => person.allergies);
}

function requestedSlots(mask: SlotMask): { day: DayOfWeek; slot: MealSlot }[] {
  const slots: { day: DayOfWeek; slot: MealSlot }[] = [];
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      if (mask[day][slot]) slots.push({ day, slot });
    }
  }
  return slots;
}

function formatSlot(item: { day: DayOfWeek; slot: MealSlot }): string {
  return `${item.day} ${item.slot}`;
}

function slotsMatchRequested(
  meals: GeneratedMeal[],
  requested: { day: DayOfWeek; slot: MealSlot }[],
): boolean {
  const got = new Set(meals.map((meal) => formatSlot(meal)));
  const want = new Set(requested.map(formatSlot));
  if (got.size !== want.size) return false;
  for (const key of got) {
    if (!want.has(key)) return false;
  }
  return true;
}

function hasDuplicateTitles(meals: GeneratedMeal[]): boolean {
  const seen: string[] = [];
  for (const meal of meals) {
    if (isDuplicateTitle(meal.title, seen)) return true;
    seen.push(meal.title);
  }
  return false;
}

function firstAllergen(
  meals: GeneratedMeal[],
  allergies: string[],
): string | null {
  for (const meal of meals) {
    const hit = findAllergen(meal.ingredients, allergies);
    if (hit) return hit;
  }
  return null;
}

export async function generateWeekPlan(input: {
  household: Household;
  kitchen: KitchenItem[];
  slotMask: SlotMask;
  adapter: { complete(req: AdapterRequest): Promise<AdapterResult> };
  logTrace: (t: Omit<AiTrace, "id" | "createdAt">) => void;
  settings: Pick<AiSettings, "mode" | "baseUrl" | "model">;
}): Promise<GenerateSuccess | PlanFailure> {
  const requested = requestedSlots(input.slotMask);
  if (requested.length === 0) {
    return { ok: false, message: NO_SLOTS };
  }

  const brief = buildHouseholdBrief({
    household: input.household,
    kitchen: input.kitchen,
    slotMask: input.slotMask,
  });
  const system = `${brief}\n\n${HARD_RULES}`;
  const user = `Generate meals for: ${requested.map(formatSlot).join(", ")}`;
  const allergies = collectAllergies(input.household);

  let userMessage = user;
  for (let attempt = 0; attempt < 2; attempt++) {
    const kind: TraceKind = attempt === 0 ? "generate" : "generate-retry";
    const messages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: userMessage },
    ];
    const req: AdapterRequest = {
      messages,
      jsonSchema: mealsJsonSchema as unknown as Record<string, unknown>,
      schemaName: "week_plan",
    };

    const log = (validation: ValidationResult, responseText: string) => {
      input.logTrace({
        kind,
        mode: input.settings.mode,
        baseUrl: input.settings.baseUrl,
        model: input.settings.model,
        requestText: JSON.stringify(messages),
        responseText,
        validation,
      });
    };

    const result = await input.adapter.complete(req);
    if (!result.ok) {
      log("transport", result.error);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\n${result.error}`;
        continue;
      }
      return { ok: false, message: TRANSPORT_FAIL };
    }

    const parsed = parseMealsResponse(result.text);
    if (!parsed.ok) {
      log(parsed.reason, result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\n${parsed.reason}`;
        continue;
      }
      return { ok: false, message: UNUSABLE_PLAN };
    }

    if (!slotsMatchRequested(parsed.meals, requested)) {
      log("schema", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nschema`;
        continue;
      }
      return { ok: false, message: UNUSABLE_PLAN };
    }

    const allergen = firstAllergen(parsed.meals, allergies);
    if (allergen) {
      log("allergen", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nallergen: ${allergen}`;
        continue;
      }
      return { ok: false, message: UNUSABLE_PLAN };
    }

    if (hasDuplicateTitles(parsed.meals)) {
      log("duplicate", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nduplicate`;
        continue;
      }
      return { ok: false, message: UNUSABLE_PLAN };
    }

    log("ok", result.text);
    return { ok: true, meals: parsed.meals };
  }

  return { ok: false, message: UNUSABLE_PLAN };
}
