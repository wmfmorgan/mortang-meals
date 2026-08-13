import { buildHouseholdBrief } from "@/household/brief";
import { findAllergen } from "@/meals/allergen";
import { isDuplicateTitle, normalizeTitle } from "@/meals/duplicates";
import { parseSingleMealResponse, singleMealJsonSchema } from "@/meals/schema";
import type {
  AdapterRequest,
  AdapterResult,
  AiSettings,
  AiTrace,
  GeneratedMeal,
  Household,
  KitchenItem,
  SlotMask,
  TraceKind,
  ValidationResult,
} from "@/lib/types";
import { collectAllergies, type PlanFailure } from "./generate-plan";

export type { PlanFailure };
export type SwapSuccess = { ok: true; meal: GeneratedMeal };

const TRANSPORT_FAIL = "The model didn’t respond";
const SWAP_FAIL = "Couldn’t find a different meal, try again.";

const HARD_RULES = [
  "Replace only the requested day and slot.",
  "The meal day and slot must match the meal being replaced.",
  "Use the household servings.",
  "Never include ingredients that match any allergy.",
  "Honor avoidances.",
  "Respond with JSON only.",
  "Do not repeat titles from the do-not-repeat list.",
].join("\n");

export async function swapMeal(input: {
  household: Household;
  kitchen: KitchenItem[];
  slotMask: SlotMask;
  current: GeneratedMeal;
  otherMeals: GeneratedMeal[];
  adapter: { complete(req: AdapterRequest): Promise<AdapterResult> };
  logTrace: (t: Omit<AiTrace, "id" | "createdAt">) => void;
  settings: Pick<AiSettings, "mode" | "baseUrl" | "model">;
}): Promise<SwapSuccess | PlanFailure> {
  const taken = [input.current.title, ...input.otherMeals.map((meal) => meal.title)];
  const doNotRepeat = [
    normalizeTitle(input.current.title),
    ...input.otherMeals.map((meal) => normalizeTitle(meal.title)),
  ];
  const titles = doNotRepeat.join(", ");

  const brief = buildHouseholdBrief({
    household: input.household,
    kitchen: input.kitchen,
    slotMask: input.slotMask,
    extraRules: [`Do not repeat: ${titles}`],
  });
  const system = `${brief}\n\n${HARD_RULES}`;
  const user = `Replace ${input.current.day} ${input.current.slot}. Do not repeat: ${titles}.`;
  const allergies = collectAllergies(input.household);

  let userMessage = user;
  for (let attempt = 0; attempt < 2; attempt++) {
    const kind: TraceKind = attempt === 0 ? "swap" : "swap-retry";
    const messages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: userMessage },
    ];
    const req: AdapterRequest = {
      messages,
      jsonSchema: singleMealJsonSchema as unknown as Record<string, unknown>,
      schemaName: "single_meal",
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

    const parsed = parseSingleMealResponse(result.text);
    if (!parsed.ok) {
      log(parsed.reason, result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\n${parsed.reason}`;
        continue;
      }
      return { ok: false, message: SWAP_FAIL };
    }

    const meal = parsed.meal;
    if (meal.day !== input.current.day || meal.slot !== input.current.slot) {
      log("schema", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nschema`;
        continue;
      }
      return { ok: false, message: SWAP_FAIL };
    }

    const allergen = findAllergen(meal.ingredients, allergies);
    if (allergen) {
      log("allergen", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nallergen: ${allergen}`;
        continue;
      }
      return { ok: false, message: SWAP_FAIL };
    }

    if (isDuplicateTitle(meal.title, taken)) {
      log("duplicate", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nduplicate`;
        continue;
      }
      return { ok: false, message: SWAP_FAIL };
    }

    log("ok", result.text);
    return { ok: true, meal };
  }

  return { ok: false, message: SWAP_FAIL };
}
