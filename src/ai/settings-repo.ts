import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiSettings } from "@/lib/schema";
import type { AiSettings } from "@/lib/types";

const SETTINGS_ID = "default";

const DEFAULT_SETTINGS: AiSettings = {
  mode: "grok",
  baseUrl: "https://api.x.ai/v1",
  model: "grok-4.6",
  customApiKey: null,
  developerTools: false,
};

type SettingsRow = typeof aiSettings.$inferSelect;

function mapSettings(row: SettingsRow): AiSettings {
  return {
    mode: row.mode as AiSettings["mode"],
    baseUrl: row.baseUrl,
    model: row.model,
    customApiKey: row.customApiKey,
    developerTools: row.developerTools === 1,
  };
}

function settingsValues(settings: AiSettings) {
  return {
    mode: settings.mode,
    baseUrl: settings.baseUrl,
    model: settings.model,
    customApiKey: settings.customApiKey,
    developerTools: settings.developerTools ? 1 : 0,
  };
}

export function getSettings(): AiSettings {
  const db = getDb();
  const row = db.select().from(aiSettings).get();
  if (row) return mapSettings(row);
  db.insert(aiSettings)
    .values({ id: SETTINGS_ID, ...settingsValues(DEFAULT_SETTINGS) })
    .run();
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(patch: Partial<AiSettings>): AiSettings {
  const next = { ...getSettings(), ...patch };
  const db = getDb();
  const row = db.select().from(aiSettings).get();
  if (!row) {
    db.insert(aiSettings)
      .values({ id: SETTINGS_ID, ...settingsValues(next) })
      .run();
    return next;
  }
  db.update(aiSettings)
    .set(settingsValues(next))
    .where(eq(aiSettings.id, row.id))
    .run();
  return next;
}
