import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./db-url";
import * as schema from "./schema";

export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let db: AppDb | null = null;

export function getDb(): AppDb {
  if (db) return db;
  // max: 1 — serverless; transaction pooler + few clients avoids EMAXCONNSESSION.
  client = postgres(resolveDatabaseUrl(), { prepare: false, max: 1 });
  db = drizzle(client, { schema });
  return db;
}

export async function resetDbForTests(): Promise<void> {
  const database = getDb();
  await database.execute(sql`
    truncate table
      public.ai_usage,
      public.ai_traces,
      public.ai_settings,
      public.library_generate_prefs,
      public.meals,
      public.week_plans,
      public.kitchen_items,
      public.kitchen_prefs,
      public.people,
      public.households
    restart identity cascade
  `);
}
