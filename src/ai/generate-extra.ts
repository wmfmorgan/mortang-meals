import { buildHouseholdBrief } from "@/household/brief";
import { findAllergen } from "@/meals/allergen";
import { isDuplicateTitle, normalizeTitle } from "@/meals/duplicates";
import { suggestionExtra } from "@/meals/extras";
import {
  applySourceUrl,
  extraRecipeJsonSchema,
  extraSuggestionJsonSchema,
  parseExtraRecipeResponse,
  parseExtraSuggestionResponse,
} from "@/meals/schema";
import type {
  AdapterRequest,
  AdapterResult,
  AiSettings,
  AiTrace,
  ExtraKind,
  ExtraMode,
  GeneratedMeal,
  Household,
  KitchenItem,
  KitchenPrefs,
  MealExtra,
  SlotMask,
  TraceKind,
  ValidationResult,
} from "@/lib/types";
import { grokWebSearchEnabled } from "./adapter";
import { collectAllergies, type PlanFailure } from "./generate-plan";

export type ExtraSuccess = { ok: true; extra: Omit<MealExtra, "id" | "kind"> };

const TRANSPORT_FAIL = "The model didn’t respond";
const EXTRA_FAIL = "Couldn’t add that extra, try again.";

const HARD_RULES = [
  "Never include ingredients that match any allergy.",
  "Honor avoidances.",
  "Respond with JSON only.",
  "Do not repeat titles from the do-not-repeat list.",
  "The extra must complement the parent meal, not replace it.",
  'Ingredient quantity must be a string such as "1", "1/2", or "1/4". Never use 0 for an ingredient that is used.',
].join("\n");

const SUGGESTION_RULES = [
  "Return only a short dish title, like baked potato or key lime pie.",
  "Do not include ingredients or steps.",
].join("\n");

const RECIPE_RULES = [
  "Return a full recipe for the extra.",
  "Use the household servings.",
].join("\n");

const NO_URL_RULE = "sourceUrl must be null. Do not invent URLs.";

const WEB_SEARCH_RULES = [
  "Use web_search to find a real published recipe for this extra.",
  "Copy accurate quantities, units, cook times, and steps from the source.",
  "Do not invent amounts when a source lists them.",
  "Set sourceUrl to the cited page URL, or null if you cannot cite a real page.",
].join("\n");

function extraLabel(kind: ExtraKind): string {
  return kind === "side" ? "side" : "dessert";
}

export async function generateExtra(input: {
  household: Household;
  kitchen: KitchenItem[];
  prefs?: KitchenPrefs;
  slotMask: SlotMask;
  parent: GeneratedMeal;
  kind: ExtraKind;
  mode: ExtraMode;
  keepTitle?: string;
  reservedTitles: string[];
  adapter: { complete(req: AdapterRequest): Promise<AdapterResult> };
  logTrace: (t: Omit<AiTrace, "id" | "createdAt">) => void;
  settings: Pick<AiSettings, "mode" | "baseUrl" | "model"> & {
    webSearch?: boolean;
  };
}): Promise<ExtraSuccess | PlanFailure> {
  const taken = [input.parent.title, ...input.reservedTitles];
  const titles = taken.map((title) => normalizeTitle(title)).join(", ");
  const label = extraLabel(input.kind);
  const keepTitle = input.keepTitle?.trim() ?? "";

  const brief = buildHouseholdBrief({
    household: input.household,
    kitchen: input.kitchen,
    prefs: input.prefs,
    slotMask: input.slotMask,
    extraRules: [
      `Parent meal: ${input.parent.title} (${input.parent.day} ${input.parent.slot}).`,
      `Do not repeat: ${titles}`,
    ],
  });
  const searchOn = grokWebSearchEnabled({
    mode: input.settings.mode,
    webSearch: input.settings.webSearch === true,
  });

  const modeRules =
    input.mode === "suggestion"
      ? SUGGESTION_RULES
      : searchOn
        ? `${RECIPE_RULES}\n${WEB_SEARCH_RULES}`
        : `${RECIPE_RULES}\n${NO_URL_RULE}`;
  const system = `${brief}\n\n${HARD_RULES}\n${modeRules}`;

  const user =
    input.mode === "suggestion"
      ? `Suggest one complementary ${label} title for ${input.parent.day} ${input.parent.slot} ${input.parent.title}. Do not repeat: ${titles}.`
      : keepTitle
        ? `Write a full recipe titled ${keepTitle} as a ${label} for ${input.parent.day} ${input.parent.slot} ${input.parent.title}.`
        : `Write a full ${label} recipe that complements ${input.parent.day} ${input.parent.slot} ${input.parent.title}. Do not repeat: ${titles}.`;

  const allergies = collectAllergies(input.household);
  let userMessage = user;

  for (let attempt = 0; attempt < 2; attempt++) {
    const kind: TraceKind = attempt === 0 ? "extra" : "extra-retry";
    const messages = [
      { role: "system" as const, content: system },
      { role: "user" as const, content: userMessage },
    ];
    const req: AdapterRequest = {
      messages,
      jsonSchema:
        input.mode === "suggestion"
          ? (extraSuggestionJsonSchema as unknown as Record<string, unknown>)
          : (extraRecipeJsonSchema as unknown as Record<string, unknown>),
      schemaName: input.mode === "suggestion" ? "extra_suggestion" : "extra_recipe",
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

    if (input.mode === "suggestion") {
      const parsed = parseExtraSuggestionResponse(result.text);
      if (!parsed.ok) {
        log(parsed.reason, result.text);
        if (attempt === 0) {
          userMessage = `${userMessage}\n\n${parsed.reason}`;
          continue;
        }
        return { ok: false, message: EXTRA_FAIL };
      }
      if (isDuplicateTitle(parsed.title, taken)) {
        log("duplicate", result.text);
        if (attempt === 0) {
          userMessage = `${userMessage}\n\nduplicate`;
          continue;
        }
        return { ok: false, message: EXTRA_FAIL };
      }
      log("ok", result.text);
      const extra = suggestionExtra({
        id: "draft",
        kind: input.kind,
        title: parsed.title,
      });
      const { id: _id, kind: _kind, ...draft } = extra;
      return { ok: true, extra: draft };
    }

    const parsed = parseExtraRecipeResponse(result.text);
    if (!parsed.ok) {
      log(parsed.reason, result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\n${parsed.reason}`;
        continue;
      }
      return { ok: false, message: EXTRA_FAIL };
    }

    const recipe = applySourceUrl(parsed.extra, searchOn);
    const title = keepTitle || recipe.title;
    const allergen = findAllergen(recipe.ingredients, allergies);
    if (allergen) {
      log("allergen", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nallergen: ${allergen}`;
        continue;
      }
      return { ok: false, message: EXTRA_FAIL };
    }
    if (!keepTitle && isDuplicateTitle(title, taken)) {
      log("duplicate", result.text);
      if (attempt === 0) {
        userMessage = `${userMessage}\n\nduplicate`;
        continue;
      }
      return { ok: false, message: EXTRA_FAIL };
    }
    log("ok", result.text);
    return {
      ok: true,
      extra: {
        mode: "recipe",
        title,
        whyItFits: recipe.whyItFits,
        cookMinutes: recipe.cookMinutes,
        method: recipe.method,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        usedWebSearch: searchOn,
        sourceUrl: recipe.sourceUrl ?? null,
      },
    };
  }

  return { ok: false, message: EXTRA_FAIL };
}
