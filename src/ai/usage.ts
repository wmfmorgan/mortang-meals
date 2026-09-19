import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { HttpResult } from "@/lib/request-auth";
import { aiUsage } from "@/lib/schema";
import type { AiSettings } from "@/lib/types";
import { DEFAULT_AI_DAILY_CAP } from "./settings-repo";

/** @deprecated Prefer settings.aiDailyCap; kept for tests that use the default. */
export const AI_DAILY_CAP = DEFAULT_AI_DAILY_CAP;

const LIMIT_MESSAGE = "Daily generate limit reached. Try again tomorrow.";

export async function consumeAiQuota(input: {
  userId: string;
  settings: AiSettings;
}): Promise<{ ok: true } | { ok: false; result: HttpResult }> {
  if (
    input.settings.mode === "custom" &&
    input.settings.customApiKey != null &&
    input.settings.customApiKey.length > 0
  ) {
    return { ok: true };
  }

  if (input.settings.aiDailyCapEnabled === false) {
    return { ok: true };
  }

  const cap = Math.max(
    1,
    Math.floor(input.settings.aiDailyCap ?? DEFAULT_AI_DAILY_CAP),
  );
  const day = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const existing = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, input.userId), eq(aiUsage.day, day)))
    .then((rows) => rows[0]);
  if ((existing?.generateCount ?? 0) >= cap) {
    return {
      ok: false,
      result: { status: 429, body: { message: LIMIT_MESSAGE } },
    };
  }

  await db
    .insert(aiUsage)
    .values({
      userId: input.userId,
      day,
      generateCount: 1,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { generateCount: sql`${aiUsage.generateCount} + 1` },
    });
  return { ok: true };
}
