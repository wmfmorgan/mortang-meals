import { z } from "zod";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import {
  resolveHandlerAuth,
  type Authed,
} from "@/lib/request-auth";
import { mondayOf } from "@/lib/week";
import type {
  AdapterRequest,
  AdapterResult,
  AiSettings,
  AiTrace,
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
  auth?: Authed;
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

function logTraceFor(householdId: string) {
  return (t: Omit<AiTrace, "id" | "createdAt">) => {
    void recordTrace({ ...t, householdId });
  };
}

async function loadReadyHousehold(
  deps?: HandlerDeps,
): Promise<
  | {
      ok: true;
      userId: string;
      householdId: string;
      household: Household;
    }
  | { ok: false; result: HttpResult }
> {
  const authed = await resolveHandlerAuth(deps?.auth);
  if (!authed.ok) return authed;
  if (authed.household.people.length === 0) {
    return {
      ok: false,
      result: jsonError(400, "Add people before generating."),
    };
  }
  const prefs = await getKitchenPrefs(authed.householdId);
  if (!authed.household.dietStyle.trim() && !prefs.overallDiet.trim()) {
    return {
      ok: false,
      result: jsonError(400, "Add a diet style before generating."),
    };
  }
  return authed;
}

export async function handleGenerate(
  body: unknown,
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const parsed = generateBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "slotMask is required.");
  }

  const ready = await loadReadyHousehold(deps);
  if (!ready.ok) return ready.result;
  const { householdId, household } = ready;

  if (!hasAnySlot(parsed.data.slotMask)) {
    return jsonError(400, "Turn on at least one meal slot.");
  }

  const current = await getCurrentPlan(householdId);
  const pinned = current?.meals.filter((meal) => meal.pinned) ?? [];
  const effectiveMask = maskMinusPinned(parsed.data.slotMask, pinned);
  if (!hasAnySlot(effectiveMask)) {
    return jsonError(400, ALL_PINNED);
  }

  const settings = await getSettings(householdId);
  if (grokKeyMissing(settings)) {
    return jsonError(400, GROK_KEY_MESSAGE);
  }

  await seedKitchenIfEmpty(householdId);
  const result = await generateWeekPlan({
    household,
    kitchen: await listKitchen(householdId),
    prefs: await getKitchenPrefs(householdId),
    slotMask: effectiveMask,
    adapter: resolveAdapter(settings, deps),
    logTrace: logTraceFor(householdId),
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
  const plan = await mergeGeneratedPlan(householdId, {
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

  const ready = await loadReadyHousehold(deps);
  if (!ready.ok) return ready.result;
  const { householdId, household } = ready;

  const plan = await getPlan(householdId, parsed.data.planId);
  if (!plan) return jsonError(404, "Plan not found.");
  const current = plan.meals.find((meal) => meal.id === parsed.data.mealId);
  if (!current) return jsonError(404, "Meal not found.");

  const settings = await getSettings(householdId);
  if (grokKeyMissing(settings)) {
    return jsonError(400, GROK_KEY_MESSAGE);
  }

  await seedKitchenIfEmpty(householdId);
  const result = await swapMeal({
    household,
    kitchen: await listKitchen(householdId),
    prefs: await getKitchenPrefs(householdId),
    slotMask: plan.slotMask,
    current,
    otherMeals: plan.meals.filter((meal) => meal.id !== current.id),
    adapter: resolveAdapter(settings, deps),
    logTrace: logTraceFor(householdId),
    settings,
    useIngredients: parsed.data.useIngredients,
    prompt: parsed.data.prompt,
  });

  if (!result.ok) {
    return jsonError(422, result.message);
  }

  const meal = await replaceMeal(
    householdId,
    plan.id,
    current.id,
    result.meal,
    grokWebSearchEnabled(settings),
  );
  const updated = await getPlan(householdId, plan.id);
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

  const ready = await loadReadyHousehold(deps);
  if (!ready.ok) return ready.result;
  const { householdId, household } = ready;

  const meal = await getMeal(householdId, parsed.data.mealId);
  if (!meal) return jsonError(404, "Meal not found.");

  const current = await getCurrentPlan(householdId);
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

  const settings = await getSettings(householdId);
  if (grokKeyMissing(settings)) {
    return jsonError(400, GROK_KEY_MESSAGE);
  }

  await seedKitchenIfEmpty(householdId);
  const reservedTitles = extraReservedTitles(
    current.meals,
    meal.id,
    parsed.data.kind,
  );
  const result = await generateExtra({
    household,
    kitchen: await listKitchen(householdId),
    prefs: await getKitchenPrefs(householdId),
    slotMask: current.slotMask,
    parent: meal,
    kind: parsed.data.kind,
    mode: parsed.data.mode,
    keepTitle: upgrading ? existing.title : undefined,
    reservedTitles,
    adapter: resolveAdapter(settings, deps),
    logTrace: logTraceFor(householdId),
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
      const saved = await saveStandaloneMeal(householdId, {
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
  return {
    status: 200,
    body: { meal: await setMealExtra(householdId, meal.id, extra) },
  };
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

  const authed = await resolveHandlerAuth(deps?.auth);
  if (!authed.ok) return authed.result;
  const { householdId, household } = authed;

  const selected = household.people.filter((person) =>
    parsed.data.personIds.includes(person.id),
  );
  if (selected.length === 0) {
    return jsonError(400, "Select at least one person.");
  }

  const settings = await getSettings(householdId);
  if (grokKeyMissing(settings)) {
    return jsonError(400, GROK_KEY_MESSAGE);
  }

  const groups = libraryGroupsFromBody(parsed.data);

  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (total > 24) {
    return jsonError(400, "Ask for at most 24 recipes at once.");
  }

  await seedKitchenIfEmpty(householdId);
  const reservedTitles = reservedTitlesForSlots(
    [
      ...(await listAllMeals(householdId)),
      ...(await listDraftMeals(householdId)),
    ].filter((meal) => !meal.takeout && !meal.leftover),
    groups.map((group) => group.slot),
  );
  const result = await generateLibraryMeals({
    household: { ...household, people: selected },
    kitchen: await listKitchen(householdId),
    prefs: await getKitchenPrefs(householdId),
    groups,
    request: parsed.data.request
      ? { slot: parsed.data.request.slot, text: parsed.data.request.text }
      : undefined,
    reservedTitles,
    adapter: resolveAdapter(settings, deps),
    logTrace: logTraceFor(householdId),
    settings,
    onProgress: deps?.onProgress,
    signal: deps?.signal,
  });

  if (!result.ok) return jsonError(422, result.message);
  if (deps?.signal?.aborted) return jsonError(422, "Generate cancelled.");

  deps?.onProgress?.({ phase: "saving", message: "Saving drafts" });
  const meals = await saveDraftMeals(
    householdId,
    result.meals.map((meal) => ({
      meal,
      slot: meal.slot,
      usedWebSearch: grokWebSearchEnabled(settings),
    })),
  );
  return { status: 200, body: { meals } };
}

export async function handleGetSettings(
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const authed = await resolveHandlerAuth(deps?.auth);
  if (!authed.ok) return authed.result;
  return {
    status: 200,
    body: { settings: toSafeSettings(await getSettings(authed.householdId)) },
  };
}

export async function handlePutSettings(
  body: unknown,
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const authed = await resolveHandlerAuth(deps?.auth);
  if (!authed.ok) return authed.result;
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid settings.");
  }
  return {
    status: 200,
    body: {
      settings: toSafeSettings(
        await saveSettings(authed.householdId, parsed.data),
      ),
    },
  };
}

export async function handleTestConnection(
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const authed = await resolveHandlerAuth(deps?.auth);
  if (!authed.ok) return authed.result;
  const settings = await getSettings(authed.householdId);
  const messages = [{ role: "user" as const, content: "Reply with pong=ok" }];

  const writeTestTrace = async (
    responseText: string,
    validation: "ok" | "transport",
  ) => {
    await recordTrace({
      householdId: authed.householdId,
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
    await writeTestTrace(GROK_KEY_MESSAGE, "transport");
    return { status: 200, body: { ok: false, message: GROK_KEY_MESSAGE } };
  }

  const result = await resolveAdapter(settings, deps).complete({
    messages,
    jsonSchema: TEST_JSON_SCHEMA,
    schemaName: "test",
  });

  await writeTestTrace(
    result.ok ? result.text : result.error,
    result.ok ? "ok" : "transport",
  );
  return {
    status: 200,
    body: {
      ok: result.ok,
      message: result.ok ? "Connection succeeded." : result.error,
    },
  };
}

export async function handleListTraces(
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const authed = await resolveHandlerAuth(deps?.auth);
  if (!authed.ok) return authed.result;
  return {
    status: 200,
    body: { traces: await listTraces(authed.householdId) },
  };
}

export async function handleClearTraces(
  deps?: HandlerDeps,
): Promise<HttpResult> {
  const authed = await resolveHandlerAuth(deps?.auth);
  if (!authed.ok) return authed.result;
  await clearTraces(authed.householdId);
  return { status: 200, body: { ok: true } };
}
