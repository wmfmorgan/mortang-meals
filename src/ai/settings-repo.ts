import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiSettings } from "@/lib/schema";
import type { AiSettings } from "@/lib/types";

const DEFAULT_SETTINGS: AiSettings = {
  mode: "grok",
  baseUrl: "https://api.x.ai/v1",
  model: "grok-4.6",
  customApiKey: null,
  developerTools: false,
  webSearch: false,
};

type SettingsRow = typeof aiSettings.$inferSelect;

function mapSettings(row: SettingsRow): AiSettings {
  return {
    mode: row.mode as AiSettings["mode"],
    baseUrl: row.baseUrl,
    model: row.model,
    customApiKey: row.customApiKey,
    developerTools: row.developerTools,
    webSearch: row.webSearch,
  };
}

function settingsValues(settings: AiSettings) {
  return {
    mode: settings.mode,
    baseUrl: settings.baseUrl,
    model: settings.model,
    customApiKey: settings.customApiKey,
    developerTools: settings.developerTools,
    webSearch: settings.webSearch,
  };
}

export async function getSettings(householdId: string): Promise<AiSettings> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.householdId, householdId))
    .limit(1);
  if (row) return mapSettings(row);
  await db.insert(aiSettings).values({
    householdId,
    ...settingsValues(DEFAULT_SETTINGS),
  });
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(
  householdId: string,
  patch: Partial<AiSettings>,
): Promise<AiSettings> {
  const next = { ...(await getSettings(householdId)), ...patch };
  const db = getDb();
  const [row] = await db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.householdId, householdId))
    .limit(1);
  if (!row) {
    await db.insert(aiSettings).values({
      householdId,
      ...settingsValues(next),
    });
    return next;
  }
  await db
    .update(aiSettings)
    .set(settingsValues(next))
    .where(eq(aiSettings.householdId, householdId));
  return next;
}
