import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import type { HttpResult } from "@/lib/request-auth";
import { aiUsage } from "@/lib/schema";
import type { AiSettings } from "@/lib/types";

export const AI_DAILY_CAP = 10;

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

  const day = new Date().toISOString().slice(0, 10);
  const db = getDb();
  const existing = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, input.userId), eq(aiUsage.day, day)))
    .then((rows) => rows[0]);
  if ((existing?.generateCount ?? 0) >= AI_DAILY_CAP) {
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
