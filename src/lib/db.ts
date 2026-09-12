import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let db: AppDb | null = null;

function resolveDatabaseUrl(): string {
  // Vercel + Supabase Marketplace injects POSTGRES_URL / POSTGRES_PRISMA_URL.
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set (also checked POSTGRES_PRISMA_URL / POSTGRES_URL)",
    );
  }
  return url;
}

export function getDb(): AppDb {
  if (db) return db;
  client = postgres(resolveDatabaseUrl(), { prepare: false, max: 5 });
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
