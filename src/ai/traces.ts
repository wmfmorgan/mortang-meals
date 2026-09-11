import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiTraces } from "@/lib/schema";
import type { AiTrace } from "@/lib/types";

type TraceRow = typeof aiTraces.$inferSelect;

let lastCreatedAtMs = 0;

function nextCreatedAt(): string {
  const now = Date.now();
  lastCreatedAtMs = now > lastCreatedAtMs ? now : lastCreatedAtMs + 1;
  return new Date(lastCreatedAtMs).toISOString();
}

function mapTrace(row: TraceRow): AiTrace {
  return {
    id: row.id,
    createdAt: row.createdAt,
    kind: row.kind as AiTrace["kind"],
    mode: row.mode as AiTrace["mode"],
    baseUrl: row.baseUrl,
    model: row.model,
    requestText: row.requestText,
    responseText: row.responseText,
    validation: row.validation as AiTrace["validation"],
  };
}

export function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(XAI_API_KEY|api[_-]?key)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

export async function recordTrace(
  input: Omit<AiTrace, "id" | "createdAt"> & { householdId: string },
): Promise<AiTrace> {
  const db = getDb();
  const row = {
    id: crypto.randomUUID(),
    householdId: input.householdId,
    createdAt: nextCreatedAt(),
    kind: input.kind,
    mode: input.mode,
    baseUrl: input.baseUrl,
    model: input.model,
    requestText: redactSecrets(input.requestText),
    responseText: redactSecrets(input.responseText),
    validation: input.validation,
  };
  await db.transaction(async (tx) => {
    await tx.insert(aiTraces).values(row);
    await tx.execute(sql`
      delete from ai_traces
      where household_id = ${input.householdId}
        and id not in (
          select id from (
            select id from ai_traces
            where household_id = ${input.householdId}
            order by created_at desc
            limit 25
          ) keepers
        )
    `);
  });
  return mapTrace(row);
}

export async function listTraces(householdId: string): Promise<AiTrace[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(aiTraces)
    .where(eq(aiTraces.householdId, householdId))
    .orderBy(desc(aiTraces.createdAt))
    .limit(25);
  return rows.map(mapTrace);
}

export async function clearTraces(householdId: string): Promise<void> {
  const db = getDb();
  await db.delete(aiTraces).where(eq(aiTraces.householdId, householdId));
}
