import { z } from "zod";
import { getHousehold } from "@/household/repo";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { mondayOf } from "@/lib/week";
import type {
  AdapterRequest,
  AdapterResult,
  AiSettings,
  ExtraKind,
  Household,
  SlotMask,
} from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { hasAnySlot as maskHasAny, maskMinusPinned } from "@/lib/slot-mask";
import {
  getCurrentPlan,
  getMeal,
  getPlan,
  listAllMeals,
  listDraftMeals,
  mergeGeneratedPlan,
  replaceMeal,
  saveDraftMeals,
  saveStandaloneMeal,
  setMealExtra,
} from "@/meals/repo";
import { mergeShoppingList } from "@/meals/shopping-list";
import { createAdapter, grokWebSearchEnabled } from "./adapter";
import { generateWeekPlan, type GenerateProgressEvent } from "./generate-plan";
import { getSettings, saveSettings } from "./settings-repo";
import { generateExtra } from "./generate-extra";
import {
  generateLibraryMeals,
  reservedTitlesForSlots,
  type LibraryGroup,
} from "./generate-library";
import { swapMeal } from "./swap-meal";
import { clearTraces, listTraces, recordTrace } from "./traces";

const GROK_KEY_MESSAGE =
  "Add XAI_API_KEY in .env.local or switch to a local model in Settings.";

export type HttpResult = { status: number; body: unknown };

export type GenerateUiEvent =
  | GenerateProgressEvent
  | { phase: "saving"; message: string };

export type GenerateStreamEvent =
  | ({ type: "progress" } & GenerateUiEvent)
  | { type: "done"; planId: string }
  | { type: "error"; status: number; message: string };

export type HandlerDeps = {
  complete?: (req: AdapterRequest) => Promise<AdapterResult>;
  onProgress?: (event: GenerateUiEvent) => void;
  signal?: AbortSignal;
};

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

const useIngredientSchema = z.object({
  name: z.string().trim().min(1),
  day: z.enum(DAYS as [(typeof DAYS)[0], ...typeof DAYS]),
  slot: z.enum(SLOTS as [(typeof SLOTS)[0], ...typeof SLOTS]),
});

const generateBodySchema = z.object({
  weekStart: z.string().optional(),
  slotMask: slotMaskSchema,
  useIngredients: z.array(useIngredientSchema).optional(),
});

const swapBodySchema = z.object({
  planId: z.string().min(1),
  mealId: z.string().min(1),
  useIngredients: z.array(useIngredientSchema).optional(),
  prompt: z.string().trim().max(200).optional(),
});

const extraBodySchema = z.object({
  mealId: z.string().min(1),
  kind: z.enum(["side", "dessert"]),
  mode: z.enum(["suggestion", "recipe"]),
});

const librarySlotGroupSchema = z.object({
  count: z.number().int().min(1).max(12),
  diet: z.string().trim().min(1),
  avoidances: z.string().optional().default(""),
});

const libraryGenerateBodySchema = z
  .object({
    personIds: z.array(z.string().min(1)).min(1),
    request: z
      .object({
        slot: z.enum(["breakfast", "lunch", "dinner", "side", "dessert"]),
        text: z.string().trim().min(1),
        diet: z.string().trim().min(1),
        avoidances: z.string().optional().default(""),
      })
      .optional(),
    breakfast: librarySlotGroupSchema.optional(),
    lunch: librarySlotGroupSchema.optional(),
    dinner: librarySlotGroupSchema.optional(),
    side: librarySlotGroupSchema.optional(),
    dessert: librarySlotGroupSchema.optional(),
  })
  .refine(
    (value) =>
      Boolean(value.request) !==
      Boolean(
        value.breakfast ||
          value.lunch ||
          value.dinner ||
          value.side ||
          value.dessert,
      ),
    { message: "Use batch groups or a one-recipe request, not both." },
  );

function libraryGroupsFromBody(
  data: z.infer<typeof libraryGenerateBodySchema>,
): LibraryGroup[] {
  if (data.request) {
    return [
      {
        slot: data.request.slot,
        count: 1,
        diet: data.request.diet,
        avoidances: data.request.avoidances,
      },
    ];
  }
  const groups: LibraryGroup[] = [];
  if (data.breakfast) groups.push({ slot: "breakfast", ...data.breakfast });
  if (data.lunch) groups.push({ slot: "lunch", ...data.lunch });
  if (data.dinner) groups.push({ slot: "dinner", ...data.dinner });
  if (data.side) groups.push({ slot: "side", ...data.side });
  if (data.dessert) groups.push({ slot: "dessert", ...data.dessert });
  return groups;
}

const settingsPatchSchema = z.object({
  mode: z.enum(["grok", "custom"]).optional(),
  baseUrl: z.string().optional(),
  model: z.string().optional(),
  customApiKey: z.string().nullable().optional(),
  developerTools: z.boolean().optional(),
  webSearch: z.boolean().optional(),
});

const TEST_JSON_SCHEMA = {
  type: "object",
  properties: { pong: { type: "string" } },
  required: ["pong"],
  additionalProperties: false,
};

function jsonError(status: number, message: string): HttpResult {
  return { status, body: { message } };
}

function resolveAdapter(settings: AiSettings, deps?: HandlerDeps) {
  if (deps?.complete) return { complete: deps.complete };
  return createAdapter(settings);
}

function grokKeyMissing(settings: AiSettings): boolean {
  return settings.mode === "grok" && !process.env.XAI_API_KEY;
}

const ALL_PINNED = "Everything you asked for is pinned.";

function hasAnySlot(mask: SlotMask): boolean {
  return maskHasAny(mask);
}

function toSafeSettings(settings: AiSettings) {
  return {
    ...settings,
    customApiKey: settings.customApiKey != null && settings.customApiKey.length > 0,
  };
}

function loadReadyHousehold():
  | { ok: true; household: Household }
  | { ok: false; result: HttpResult } {
  const household = getHousehold();
  if (!household) {
    return {
      ok: false,
      result: jsonError(400, "Add a household before generating."),
    };
  }
  if (household.people.length === 0) {
    return {
      ok: false,
      result: jsonError(400, "Add people before generating."),
    };
  }
  const prefs = getKitchenPrefs();
  if (!household.dietStyle.trim() && !prefs.overallDiet.trim()) {
    return {
      ok: false,
      result: jsonError(400, "Add a diet style before generating."),
    };
  }
  return { ok: true, household };
}

export async function handleGenerate(
  body: unknown,
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const parsed = generateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "slotMask is required.");
  }

  const ready = loadReadyHousehold();
  if (!ready.ok) return ready.result;

  if (!hasAnySlot(parsed.data.slotMask)) {
    return jsonError(400, "Turn on at least one meal slot.");
  }

  const current = getCurrentPlan();
  const pinned = current?.meals.filter((meal) => meal.pinned) ?? [];
  const effectiveMask = maskMinusPinned(parsed.data.slotMask, pinned);
  if (!hasAnySlot(effectiveMask)) {
    return jsonError(400, ALL_PINNED);
  }

  const settings = getSettings();
  if (grokKeyMissing(settings)) {
    return jsonError(400, GROK_KEY_MESSAGE);
  }

  seedKitchenIfEmpty();
  const result = await generateWeekPlan({
    household: ready.household,
    kitchen: listKitchen(),
    prefs: getKitchenPrefs(),
    slotMask: effectiveMask,
    adapter: resolveAdapter(settings, deps),
    logTrace: recordTrace,
    settings,
    reservedTitles: pinned.map((meal) => meal.title),
    useIngredients: (parsed.data.useIngredients ?? []).filter(
      (item) =>
        !pinned.some((meal) => meal.day === item.day && meal.slot === item.slot),
    ),
    onProgress: deps?.onProgress,
    signal: deps?.signal,
  });

  if (!result.ok) {
    return jsonError(422, result.message);
  }

  if (deps?.signal?.aborted) {
    return jsonError(422, "Generate cancelled.");
  }

  deps?.onProgress?.({ phase: "saving", message: "Saving the week" });
  const plan = mergeGeneratedPlan({
    weekStart: parsed.data.weekStart ?? mondayOf(new Date()),
    slotMask: parsed.data.slotMask,
    meals: result.meals,
    usedWebSearch: grokWebSearchEnabled(settings),
  });
  return { status: 200, body: { plan } };
}

export async function handleSwap(
  body: unknown,
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const parsed = swapBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "planId and mealId are required.");
  }

  const plan = getPlan(parsed.data.planId);
  if (!plan) return jsonError(404, "Plan not found.");
  const current = plan.meals.find((meal) => meal.id === parsed.data.mealId);
  if (!current) return jsonError(404, "Meal not found.");

  const ready = loadReadyHousehold();
  if (!ready.ok) return ready.result;

  const settings = getSettings();
  if (grokKeyMissing(settings)) {
    return jsonError(400, GROK_KEY_MESSAGE);
  }

  seedKitchenIfEmpty();
  const result = await swapMeal({
    household: ready.household,
    kitchen: listKitchen(),
    prefs: getKitchenPrefs(),
    slotMask: plan.slotMask,
    current,
    otherMeals: plan.meals.filter((meal) => meal.id !== current.id),
    adapter: resolveAdapter(settings, deps),
    logTrace: recordTrace,
    settings,
    useIngredients: parsed.data.useIngredients,
    prompt: parsed.data.prompt,
  });

  if (!result.ok) {
    return jsonError(422, result.message);
  }

  const meal = replaceMeal(
    plan.id,
    current.id,
    result.meal,
    grokWebSearchEnabled(settings),
  );
  const updated = getPlan(plan.id);
  return {
    status: 200,
    body: {
      meal,
      shoppingList: mergeShoppingList(updated?.meals ?? [meal]),
    },
  };
}

export async function handleGenerateExtra(
  body: unknown,
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const parsed = extraBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "mealId, kind, and mode are required.");
  }

  const meal = getMeal(parsed.data.mealId);
  if (!meal) return jsonError(404, "Meal not found.");

  const current = getCurrentPlan();
  if (!current || meal.planId !== current.id) {
    return jsonError(400, "Sides and desserts can only be added on this week.");
  }
  if (meal.slot === "breakfast") {
    return jsonError(400, "Breakfasts don’t have sides or desserts.");
  }

  const existing = meal.extras[parsed.data.kind];
  const upgrading =
    existing?.mode === "suggestion" && parsed.data.mode === "recipe";
  if (existing && !upgrading) {
    return jsonError(400, `That meal already has a ${parsed.data.kind}.`);
  }

  const ready = loadReadyHousehold();
  if (!ready.ok) return ready.result;

  const settings = getSettings();
  if (grokKeyMissing(settings)) {
    return jsonError(400, GROK_KEY_MESSAGE);
  }

  seedKitchenIfEmpty();
  const reservedTitles = extraReservedTitles(
    current.meals,
    meal.id,
    parsed.data.kind,
  );
  const result = await generateExtra({
    household: ready.household,
    kitchen: listKitchen(),
    prefs: getKitchenPrefs(),
    slotMask: current.slotMask,
    parent: meal,
    kind: parsed.data.kind,
    mode: parsed.data.mode,
    keepTitle: upgrading ? existing.title : undefined,
    reservedTitles,
    adapter: resolveAdapter(settings, deps),
    logTrace: recordTrace,
    settings,
  });

  if (!result.ok) {
    return jsonError(422, result.message);
  }

  let extra = {
    id: existing?.id ?? crypto.randomUUID(),
    kind: parsed.data.kind,
    ...result.extra,
  };
  if (extra.mode === "recipe") {
    try {
      const saved = saveStandaloneMeal({
        meal: {
          day: "monday",
          slot: parsed.data.kind,
          title: extra.title,
          whyItFits: extra.whyItFits,
          cookMinutes: extra.cookMinutes,
          method: extra.method,
          ingredients: extra.ingredients,
          steps: extra.steps,
          sourceUrl: extra.sourceUrl,
        },
        slot: parsed.data.kind,
        sourceUrl: extra.sourceUrl,
        usedWebSearch: extra.usedWebSearch,
      });
      extra = { ...extra, id: saved.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("already in the library")) throw error;
    }
  }
  return { status: 200, body: { meal: setMealExtra(meal.id, extra) } };
}

function extraReservedTitles(
  meals: { id: string; title: string; extras: { side: { title: string } | null; dessert: { title: string } | null } }[],
  mealId: string,
  kind: ExtraKind,
): string[] {
  const titles: string[] = [];
  for (const item of meals) {
    if (item.id !== mealId) titles.push(item.title);
    if (item.extras.side && !(item.id === mealId && kind === "side")) {
      titles.push(item.extras.side.title);
    }
    if (item.extras.dessert && !(item.id === mealId && kind === "dessert")) {
      titles.push(item.extras.dessert.title);
    }
  }
  return titles;
}

export async function handleGenerateLibrary(
  body: unknown,
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const parsed = libraryGenerateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "Choose people and either a batch of meal types or one recipe request.",
    );
  }

  const household = getHousehold();
  if (!household) {
    return jsonError(400, "Add a household before generating.");
  }
  const selected = household.people.filter((person) =>
    parsed.data.personIds.includes(person.id),
  );
  if (selected.length === 0) {
    return jsonError(400, "Select at least one person.");
  }

  const settings = getSettings();
  if (grokKeyMissing(settings)) {
    return jsonError(400, GROK_KEY_MESSAGE);
  }

  const groups = libraryGroupsFromBody(parsed.data);

  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (total > 24) {
    return jsonError(400, "Ask for at most 24 recipes at once.");
  }

  seedKitchenIfEmpty();
  const reservedTitles = reservedTitlesForSlots(
    [...listAllMeals(), ...listDraftMeals()].filter(
      (meal) => !meal.takeout && !meal.leftover,
    ),
    groups.map((group) => group.slot),
  );
  const result = await generateLibraryMeals({
    household: { ...household, people: selected },
    kitchen: listKitchen(),
    prefs: getKitchenPrefs(),
    groups,
    request: parsed.data.request
      ? { slot: parsed.data.request.slot, text: parsed.data.request.text }
      : undefined,
    reservedTitles,
    adapter: resolveAdapter(settings, deps),
    logTrace: recordTrace,
    settings,
    onProgress: deps?.onProgress,
    signal: deps?.signal,
  });

  if (!result.ok) return jsonError(422, result.message);
  if (deps?.signal?.aborted) return jsonError(422, "Generate cancelled.");

  deps?.onProgress?.({ phase: "saving", message: "Saving drafts" });
  const meals = saveDraftMeals(
    result.meals.map((meal) => ({
      meal,
      slot: meal.slot,
      usedWebSearch: grokWebSearchEnabled(settings),
    })),
  );
  return { status: 200, body: { meals } };
}

export function handleGetSettings(): HttpResult {
  return { status: 200, body: { settings: toSafeSettings(getSettings()) } };
}

export function handlePutSettings(body: unknown): HttpResult {
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid settings.");
  }
  return {
    status: 200,
    body: { settings: toSafeSettings(saveSettings(parsed.data)) },
  };
}

export async function handleTestConnection(
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const settings = getSettings();
  const messages = [{ role: "user" as const, content: "Reply with pong=ok" }];

  const writeTestTrace = (
    responseText: string,
    validation: "ok" | "transport",
  ) => {
    recordTrace({
      kind: "test",
      mode: settings.mode,
      baseUrl: settings.baseUrl,
      model: settings.model,
      requestText: JSON.stringify(messages),
      responseText,
      validation,
    });
  };

  if (grokKeyMissing(settings) && !deps?.complete) {
    writeTestTrace(GROK_KEY_MESSAGE, "transport");
    return { status: 200, body: { ok: false, message: GROK_KEY_MESSAGE } };
  }

  const result = await resolveAdapter(settings, deps).complete({
    messages,
    jsonSchema: TEST_JSON_SCHEMA,
    schemaName: "test",
  });

  writeTestTrace(result.ok ? result.text : result.error, result.ok ? "ok" : "transport");
  return {
    status: 200,
    body: {
      ok: result.ok,
      message: result.ok ? "Connection succeeded." : result.error,
    },
  };
}

export function handleListTraces(): HttpResult {
  return { status: 200, body: { traces: listTraces() } };
}

export function handleClearTraces(): HttpResult {
  clearTraces();
  return { status: 200, body: { ok: true } };
}
