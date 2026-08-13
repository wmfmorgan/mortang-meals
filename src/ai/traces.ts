import { desc, sql } from "drizzle-orm";
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

export function recordTrace(input: Omit<AiTrace, "id" | "createdAt">): AiTrace {
  const db = getDb();
  const row = {
    id: crypto.randomUUID(),
    createdAt: nextCreatedAt(),
    kind: input.kind,
    mode: input.mode,
    baseUrl: input.baseUrl,
    model: input.model,
    requestText: redactSecrets(input.requestText),
    responseText: redactSecrets(input.responseText),
    validation: input.validation,
  };
  db.transaction((tx) => {
    tx.insert(aiTraces).values(row).run();
    tx.run(
      sql`DELETE FROM ai_traces WHERE id NOT IN (
        SELECT id FROM (
          SELECT id FROM ai_traces ORDER BY created_at DESC LIMIT 25
        )
      )`,
    );
  });
  return mapTrace(row);
}

export function listTraces(): AiTrace[] {
  const db = getDb();
  return db
    .select()
    .from(aiTraces)
    .orderBy(desc(aiTraces.createdAt))
    .limit(25)
    .all()
    .map(mapTrace);
}

export function clearTraces(): void {
  const db = getDb();
  db.delete(aiTraces).run();
}
