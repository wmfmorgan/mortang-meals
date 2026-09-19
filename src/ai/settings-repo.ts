import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiSettings, appSettings } from "@/lib/schema";
import type { AiSettings } from "@/lib/types";

/** Default shared-key daily cap when the setting is on. */
export const DEFAULT_AI_DAILY_CAP = 10;

const DEFAULT_SETTINGS: AiSettings = {
  mode: "grok",
  baseUrl: "https://api.x.ai/v1",
  model: "grok-4.6",
  customApiKey: null,
  developerTools: false,
  webSearch: false,
  reasoningEffort: "high",
  aiDailyCapEnabled: true,
  aiDailyCap: DEFAULT_AI_DAILY_CAP,
};

const APP_SETTINGS_ID = "default";

const REASONING_EFFORTS = new Set(["low", "medium", "high", "xhigh"]);

function parseReasoningEffort(
  raw: string | null | undefined,
): AiSettings["reasoningEffort"] {
  if (raw && REASONING_EFFORTS.has(raw)) {
    return raw as AiSettings["reasoningEffort"];
  }
  return DEFAULT_SETTINGS.reasoningEffort;
}

function parseAiDailyCap(raw: number | null | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return DEFAULT_SETTINGS.aiDailyCap;
  }
  return Math.max(1, Math.floor(raw));
}

type GlobalFields = Pick<
  AiSettings,
  | "mode"
  | "baseUrl"
  | "model"
  | "customApiKey"
  | "webSearch"
  | "reasoningEffort"
  | "aiDailyCapEnabled"
  | "aiDailyCap"
>;

function globalValues(settings: GlobalFields) {
  return {
    mode: settings.mode,
    baseUrl: settings.baseUrl,
    model: settings.model,
    customApiKey: settings.customApiKey,
    webSearch: settings.webSearch,
    reasoningEffort: settings.reasoningEffort,
    aiDailyCapEnabled: settings.aiDailyCapEnabled,
    aiDailyCap: parseAiDailyCap(settings.aiDailyCap),
  };
}

async function ensureGlobalSettings(): Promise<GlobalFields> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, APP_SETTINGS_ID))
    .limit(1);
  if (row) {
    return {
      mode: row.mode as AiSettings["mode"],
      baseUrl: row.baseUrl,
      model: row.model,
      customApiKey: row.customApiKey,
      webSearch: row.webSearch,
      reasoningEffort: parseReasoningEffort(row.reasoningEffort),
      aiDailyCapEnabled: row.aiDailyCapEnabled ?? true,
      aiDailyCap: parseAiDailyCap(row.aiDailyCap),
    };
  }
  const seed = globalValues(DEFAULT_SETTINGS);
  await db.insert(appSettings).values({ id: APP_SETTINGS_ID, ...seed });
  return {
    mode: DEFAULT_SETTINGS.mode,
    baseUrl: DEFAULT_SETTINGS.baseUrl,
    model: DEFAULT_SETTINGS.model,
    customApiKey: DEFAULT_SETTINGS.customApiKey,
    webSearch: DEFAULT_SETTINGS.webSearch,
    reasoningEffort: DEFAULT_SETTINGS.reasoningEffort,
    aiDailyCapEnabled: DEFAULT_SETTINGS.aiDailyCapEnabled,
    aiDailyCap: DEFAULT_SETTINGS.aiDailyCap,
  };
}

async function ensureHouseholdSettings(
  householdId: string,
): Promise<{ developerTools: boolean }> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.householdId, householdId))
    .limit(1);
  if (row) return { developerTools: row.developerTools };

  const global = await ensureGlobalSettings();
  await db.insert(aiSettings).values({
    householdId,
    mode: global.mode,
    baseUrl: global.baseUrl,
    model: global.model,
    customApiKey: global.customApiKey,
    webSearch: global.webSearch,
    developerTools: false,
  });
  return { developerTools: false };
}

export async function getSettings(householdId: string): Promise<AiSettings> {
  const [global, household] = await Promise.all([
    ensureGlobalSettings(),
    ensureHouseholdSettings(householdId),
  ]);
  return {
    ...global,
    developerTools: household.developerTools,
  };
}

export async function saveSettings(
  householdId: string,
  patch: Partial<AiSettings>,
): Promise<AiSettings> {
  const current = await getSettings(householdId);
  const next: AiSettings = {
    ...current,
    ...patch,
    aiDailyCap: parseAiDailyCap(patch.aiDailyCap ?? current.aiDailyCap),
  };
  const db = getDb();

  await db
    .insert(appSettings)
    .values({ id: APP_SETTINGS_ID, ...globalValues(next) })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: globalValues(next),
    });

  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.householdId, householdId))
    .limit(1);
  if (!row) {
    await db.insert(aiSettings).values({
      householdId,
      mode: next.mode,
      baseUrl: next.baseUrl,
      model: next.model,
      customApiKey: next.customApiKey,
      webSearch: next.webSearch,
      developerTools: next.developerTools,
    });
  } else {
    await db
      .update(aiSettings)
      .set({ developerTools: next.developerTools })
      .where(eq(aiSettings.householdId, householdId));
  }

  return next;
}
