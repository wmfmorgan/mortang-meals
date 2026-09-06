import { buildHouseholdBrief } from "@/household/brief";
import { findAllergen } from "@/meals/allergen";
import { isDuplicateTitle } from "@/meals/duplicates";
import {
  applySourceUrl,
  mealsJsonSchema,
  parseMealsResponse,
} from "@/meals/schema";
import type {
  AdapterRequest,
  AdapterResult,
  AiSettings,
  AiTrace,
  GeneratedMeal,
  Household,
  KitchenItem,
  KitchenPrefs,
  SlotMask,
  TraceKind,
  ValidationResult,
  WeekSlot,
} from "@/lib/types";
import { emptySlotMask } from "@/lib/slot-mask";
import { grokWebSearchEnabled } from "./adapter";
import { collectAllergies, type PlanFailure } from "./generate-plan";

export type LibraryGroup = {
  slot: WeekSlot;
  count: number;
  diet: string;
  avoidances: string;
};

export type LibraryRequest = {
  slot: WeekSlot;
  text: string;
};

export type LibraryGenerateSuccess = { ok: true; meals: GeneratedMeal[] };

const TRANSPORT_FAIL = "The model didn’t respond";
const UNUSABLE = "Couldn’t get usable recipes, try again.";

const HARD_RULES = [
  "Fill only the requested meal types and counts.",
  "Use the household servings.",
  "Never include ingredients that match any allergy.",
  "Honor avoidances as hard excludes.",
  "Respond with JSON only.",
  "No duplicate titles.",
  'Ingredient quantity must be a string such as "1", "1/2", or "1/4". Never use 0 for an ingredient that is used.',
].join("\n");

const NO_URL_RULE = "sourceUrl must be null. Do not invent URLs.";

const WEB_SEARCH_RULES = [
  "Use web_search to find real published recipes.",
  "Copy accurate quantities, units, cook times, and steps from the sources.",
  "Do not invent amounts when a source lists them.",
  "Set sourceUrl to the cited page URL, or null if you cannot cite a real page.",
].join("\n");

export function parseAvoidanceList(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dummyMask(slots: WeekSlot[]): SlotMask {
  const mask = emptySlotMask();
  for (const slot of slots) {
    mask.monday[slot] = true;
  }
  return mask;
}

function countsMatch(meals: GeneratedMeal[], groups: LibraryGroup[]): boolean {
  if (meals.some((meal) => meal.slot !== "breakfast" && meal.slot !== "lunch" && meal.slot !== "dinner")) {
    return false;
  }
  for (const group of groups) {
    if (meals.filter((meal) => meal.slot === group.slot).length !== group.count) {
      return false;
    }
  }
  const allowed = new Set(groups.map((group) => group.slot));
  return meals.every((meal) => allowed.has(meal.slot as WeekSlot));
}

export async function generateLibraryMeals(input: {
  household: Household;
  kitchen: KitchenItem[];
  prefs?: KitchenPrefs;
  groups: LibraryGroup[];
  request?: LibraryRequest;
  reservedTitles: string[];
  adapter: { complete(req: AdapterRequest): Promise<AdapterResult> };
  logTrace: (t: Omit<AiTrace, "id" | "createdAt">) => void;
  settings: Pick<AiSettings, "mode" | "baseUrl" | "model"> & {
    webSearch?: boolean;
  };
  onProgress?: (event: {
    phase: "brief" | "calling" | "validating" | "retry";
    message: string;
    attempt?: number;
    model?: string;
  }) => void;
  signal?: AbortSignal;
}): Promise<LibraryGenerateSuccess | PlanFailure> {
  if (input.groups.length === 0) {
    return { ok: false, message: "Turn on at least one meal type." };
  }

  const total = input.groups.reduce((sum, group) => sum + group.count, 0);
  input.onProgress?.({
    phase: "brief",
    message: `Writing the brief for ${total} recipe${total === 1 ? "" : "s"}`,
  });

  const extraRules: string[] = [];
  const hardNames = [...collectAllergies(input.household)];
  for (const group of input.groups) {
    extraRules.push(
      `${group.slot}: ${group.count} recipe${group.count === 1 ? "" : "s"}. Diet: ${group.diet}.`,
    );
    for (const item of parseAvoidanceList(group.avoidances)) {
      extraRules.push(`Never use ${item} (${group.slot})`);
      hardNames.push(item);
    }
  }
  if (input.request?.text.trim()) {
    extraRules.push(
      `Honor this request for the ${input.request.slot} recipe: ${input.request.text.trim()}`,
    );
  }
  if (input.reservedTitles.length > 0) {
    extraRules.push(`Do not repeat: ${input.reservedTitles.join(", ")}`);
  }

  const brief = buildHouseholdBrief({
    household: input.household,
    kitchen: input.kitchen,
    prefs: input.prefs,
    slotMask: dummyMask(input.groups.map((group) => group.slot)),
    extraRules,
    forLibrary: true,
  });
  const searchOn = grokWebSearchEnabled({
    mode: input.settings.mode,
    webSearch: input.settings.webSearch === true,
  });
  const timeRule = input.prefs
    ? `Keep cookMinutes at or under ${input.prefs.maxCookMinutes}.`
    : null;
  const rules = [HARD_RULES, timeRule, searchOn ? null : NO_URL_RULE]
    .filter(Boolean)
    .join("\n");
  const system = searchOn
    ? `${brief}\n\n${rules}\n${WEB_SEARCH_RULES}`
    : `${brief}\n\n${rules}`;
  const wanted = input.groups
    .map((group) => `${group.count} ${group.slot}${group.count === 1 ? "" : "s"}`)
    .join(", ");
  const user = input.request?.text.trim()
    ? `Generate 1 ${input.request.slot}: ${input.request.text.trim()}. Set day to monday.`
    : `Generate ${wanted}. Set day to monday for every meal.`;

  const taken = [...input.reservedTitles];
  let userMessage = user;
  for (let attempt = 0; attempt < 2; attempt++) {
    const kind: TraceKind = attempt === 0 ? "library" : "library-retry";
    input.onProgress?.({
      phase: attempt === 0 ? "calling" : "retry",
      message:
        attempt === 0
          ? `Calling ${input.settings.model}`
          : `Calling ${input.settings.model} again`,
      attempt: attempt + 1,
      model: input.settings.model,
    });
    if (input.signal?.aborted) {
      return { ok: false, message: "Generate cancelled." };
    }
    const messages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: userMessage },
    ];
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
    const result = await input.adapter.complete({
      messages,
      jsonSchema: mealsJsonSchema as unknown as Record<string, unknown>,
      schemaName: "week_plan",
      signal: input.signal,
    });
    if (!result.ok) {
      log("transport", result.error);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\n${result.error}`;
        continue;
      }
      return { ok: false, message: TRANSPORT_FAIL };
    }
    input.onProgress?.({
      phase: "validating",
      message: "Checking the recipes",
      attempt: attempt + 1,
    });
    const parsed = parseMealsResponse(result.text);
    if (!parsed.ok) {
      log(parsed.reason, result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\n${parsed.reason}`;
        continue;
      }
      return { ok: false, message: UNUSABLE };
    }
    if (!countsMatch(parsed.meals, input.groups)) {
      log("schema", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nschema`;
        continue;
      }
      return { ok: false, message: UNUSABLE };
    }
    const titles: string[] = [...taken];
    let duplicate = false;
    for (const meal of parsed.meals) {
      if (isDuplicateTitle(meal.title, titles)) {
        duplicate = true;
        break;
      }
      titles.push(meal.title);
    }
    if (duplicate) {
      log("duplicate", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nduplicate`;
        continue;
      }
      return { ok: false, message: UNUSABLE };
    }
    const allergen = parsed.meals
      .map((meal) => findAllergen(meal.ingredients, hardNames))
      .find(Boolean);
    if (allergen) {
      log("allergen", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nallergen: ${allergen}`;
        continue;
      }
      return { ok: false, message: UNUSABLE };
    }
    log("ok", result.text);
    return {
      ok: true,
      meals: parsed.meals.map((meal) => ({
        ...applySourceUrl(meal, searchOn),
        day: "monday",
      })),
    };
  }
  return { ok: false, message: UNUSABLE };
}
