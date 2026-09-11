import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import {
  aiSettings,
  aiTraces,
  aiUsage,
  households,
  kitchenItems,
  kitchenPrefs,
  libraryGeneratePrefs,
  meals,
  people,
  weekPlans,
} from "../src/lib/schema";
import { emptySlotMask } from "../src/lib/slot-mask";
import { parseMealExtras } from "../src/meals/extras";

const SQLITE_TABLES = [
  "households",
  "people",
  "kitchen_prefs",
  "kitchen_items",
  "week_plans",
  "meals",
  "library_generate_prefs",
  "ai_settings",
  "ai_traces",
] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALREADY_HAS_MEALS =
  "Household already has meals. Re-run with --force.";

type SqliteRow = Record<string, unknown>;

export async function importSqlite(input: {
  dbPath: string;
  email: string;
  force?: boolean;
}): Promise<{ meals: number; plans: number }> {
  if (!fs.existsSync(input.dbPath)) {
    throw new Error(`SQLite file not found: ${input.dbPath}`);
  }

  const db = getDb();
  const userId = await findUserIdByEmail(input.email);
  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.ownerId, userId))
    .limit(1);
  if (!household) {
    throw new Error("No household for that user. Log in / finish setup first.");
  }

  const [existingMeal] = await db
    .select({ id: meals.id })
    .from(meals)
    .where(eq(meals.householdId, household.id))
    .limit(1);
  if (existingMeal && !input.force) {
    throw new Error(ALREADY_HAS_MEALS);
  }

  const sqlite = new Database(input.dbPath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const snapshot = readSqlite(sqlite);
    return await db.transaction(async (tx) => {
      if (input.force) {
        await wipeHousehold(tx, household.id);
        await tx.delete(aiUsage).where(eq(aiUsage.userId, userId));
      }

      const sqliteHousehold = snapshot.households[0];
      if (sqliteHousehold) {
        await tx
          .update(households)
          .set({
            name: asString(sqliteHousehold.name),
            dietStyle: asString(sqliteHousehold.diet_style),
            notes: asString(sqliteHousehold.notes),
            servings: asInt(sqliteHousehold.servings, 1),
          })
          .where(eq(households.id, household.id));
      }

      const householdId = household.id;
      const planIdByOld = new Map<string, string>();

      if (snapshot.people.length > 0) {
        await tx.insert(people).values(
          snapshot.people.map((row) => ({
            id: asUuid(row.id),
            householdId,
            name: asString(row.name),
            age: asInt(row.age, 0),
            sex: asNullableString(row.sex),
            allergies: asStringArray(row.allergies_json),
            avoidances: asStringArray(row.avoidances_json),
          })),
        );
      }

      const kitchenPref = snapshot.kitchen_prefs[0];
      if (kitchenPref) {
        const values = {
          expertise: asString(kitchenPref.expertise, "intermediate"),
          overallDiet: asString(kitchenPref.overall_diet),
          breakfastDiet: asString(kitchenPref.breakfast_diet),
          lunchDiet: asString(kitchenPref.lunch_diet),
          dinnerDiet: asString(kitchenPref.dinner_diet),
          maxCookMinutes: asInt(kitchenPref.max_cook_minutes, 45),
          involved: asString(kitchenPref.involved, "medium"),
        };
        await tx
          .insert(kitchenPrefs)
          .values({ id: asUuid(kitchenPref.id), householdId, ...values })
          .onConflictDoUpdate({
            target: kitchenPrefs.householdId,
            set: values,
          });
      }

      if (snapshot.kitchen_items.length > 0) {
        await tx.insert(kitchenItems).values(
          snapshot.kitchen_items.map((row) => ({
            id: asUuid(row.id),
            householdId,
            name: asString(row.name),
            kind: asString(row.kind),
            enabled: asBool(row.enabled),
            builtIn: asBool(row.built_in),
          })),
        );
      }

      let seenCurrent = false;
      const planRows = snapshot.week_plans.map((row) => {
        const oldId = asString(row.id);
        const id = asUuid(row.id);
        if (oldId) planIdByOld.set(oldId, id);
        let isCurrent = asBool(row.is_current);
        if (isCurrent && seenCurrent) isCurrent = false;
        if (isCurrent) seenCurrent = true;
        return {
          id,
          householdId,
          weekStart: asString(row.week_start),
          isCurrent,
          slotMask: asSlotMask(row.slot_mask_json),
          name: asString(row.name),
          favorited: asBool(row.favorited),
        };
      });
      if (planRows.length > 0) {
        await tx.insert(weekPlans).values(planRows);
      }

      const mealRows = snapshot.meals.map((row) => ({
        id: asUuid(row.id),
        householdId,
        planId: mapPlanId(row.plan_id, planIdByOld),
        day: asString(row.day),
        slot: asString(row.slot),
        title: asString(row.title),
        whyItFits: asString(row.why_it_fits),
        cookMinutes: asInt(row.cook_minutes, 0),
        method: asString(row.method),
        ingredients: asJsonArray(row.ingredients_json),
        steps: asStringArray(row.steps_json),
        usedWebSearch: asBool(row.used_web_search),
        pinned: asBool(row.pinned),
        weekStart: asString(row.week_start),
        createdAt: asTimestamp(row.created_at),
        sourceUrl: asNullableString(row.source_url),
        extras: parseMealExtras(asJson(row.extras_json, {})),
        draft: asBool(row.draft),
        stars: asInt(row.stars, 0),
        takeout: asBool(row.takeout),
        leftover: asBool(row.leftover),
      }));
      if (mealRows.length > 0) {
        await tx.insert(meals).values(mealRows);
      }

      const libraryPrefs = snapshot.library_generate_prefs[0];
      if (libraryPrefs) {
        const json = asJson(libraryPrefs.json, {});
        await tx
          .insert(libraryGeneratePrefs)
          .values({ id: asUuid(libraryPrefs.id), householdId, json })
          .onConflictDoUpdate({
            target: libraryGeneratePrefs.householdId,
            set: { json },
          });
      }

      const settings = snapshot.ai_settings[0];
      if (settings) {
        const values = {
          mode: asString(settings.mode, "grok"),
          baseUrl: asString(settings.base_url, "https://api.x.ai/v1"),
          model: asString(settings.model, "grok-4.6"),
          customApiKey: asNullableString(settings.custom_api_key),
          developerTools: asBool(settings.developer_tools),
          webSearch: asBool(settings.web_search),
        };
        await tx
          .insert(aiSettings)
          .values({ id: asUuid(settings.id), householdId, ...values })
          .onConflictDoUpdate({
            target: aiSettings.householdId,
            set: values,
          });
      }

      if (snapshot.ai_traces.length > 0) {
        await tx.insert(aiTraces).values(
          snapshot.ai_traces.map((row) => ({
            id: asUuid(row.id),
            householdId,
            createdAt: asTimestamp(row.created_at),
            kind: asString(row.kind),
            mode: asString(row.mode),
            baseUrl: asString(row.base_url),
            model: asString(row.model),
            requestText: asString(row.request_text),
            responseText: asString(row.response_text),
            validation: asString(row.validation),
          })),
        );
      }

      return { meals: mealRows.length, plans: planRows.length };
    });
  } finally {
    sqlite.close();
  }
}

function parseImportArgs(argv: string[]): {
  email: string;
  dbPath: string;
  force: boolean;
} {
  let email = "";
  let dbPath = "data/mortang.db";
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--email") {
      email = argv[++i] ?? "";
    } else if (arg === "--db") {
      dbPath = argv[++i] ?? dbPath;
    } else if (arg === "--force") {
      force = true;
    }
  }
  if (!email) {
    throw new Error("--email is required");
  }
  return { email, dbPath, force };
}

type AppTx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function wipeHousehold(tx: AppTx, householdId: string): Promise<void> {
  await tx.delete(aiTraces).where(eq(aiTraces.householdId, householdId));
  await tx.delete(aiSettings).where(eq(aiSettings.householdId, householdId));
  await tx
    .delete(libraryGeneratePrefs)
    .where(eq(libraryGeneratePrefs.householdId, householdId));
  await tx.delete(meals).where(eq(meals.householdId, householdId));
  await tx.delete(weekPlans).where(eq(weekPlans.householdId, householdId));
  await tx.delete(kitchenItems).where(eq(kitchenItems.householdId, householdId));
  await tx.delete(kitchenPrefs).where(eq(kitchenPrefs.householdId, householdId));
  await tx.delete(people).where(eq(people.householdId, householdId));
}

async function findUserIdByEmail(email: string): Promise<string> {
  const rows = await getDb().execute(
    sql`select id::text as id from auth.users where lower(email) = lower(${email}) limit 1`,
  );
  const row = firstRow<{ id?: string }>(rows);
  if (!row?.id) {
    throw new Error(
      `No auth user for ${email}. Log in / finish setup first.`,
    );
  }
  return row.id;
}

function firstRow<T>(result: unknown): T | undefined {
  if (Array.isArray(result)) return result[0] as T;
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: T[] }).rows;
    return Array.isArray(rows) ? rows[0] : undefined;
  }
  return undefined;
}

function readSqlite(sqlite: Database.Database): Record<
  (typeof SQLITE_TABLES)[number],
  SqliteRow[]
> {
  const snapshot = {} as Record<(typeof SQLITE_TABLES)[number], SqliteRow[]>;
  for (const table of SQLITE_TABLES) {
    snapshot[table] = hasTable(sqlite, table)
      ? (sqlite.prepare("select * from " + table).all() as SqliteRow[])
      : [];
  }
  return snapshot;
}

function hasTable(sqlite: Database.Database, table: string): boolean {
  try {
    sqlite.prepare("select 1 from " + table);
    return true;
  } catch {
    return false;
  }
}

function asUuid(value: unknown): string {
  if (typeof value === "string" && UUID_RE.test(value)) return value;
  return crypto.randomUUID();
}

function mapPlanId(
  raw: unknown,
  planIdByOld: Map<string, string>,
): string | null {
  if (raw == null || raw === "") return null;
  const key = String(raw);
  return planIdByOld.get(key) ?? (UUID_RE.test(key) ? key : null);
}

function asBool(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asTimestamp(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function asJson(value: unknown, fallback: unknown): unknown {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asJsonArray(value: unknown): unknown[] {
  const parsed = asJson(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function asStringArray(value: unknown): string[] {
  const parsed = asJsonArray(value);
  return parsed.map((item) => String(item));
}

function asSlotMask(value: unknown): ReturnType<typeof emptySlotMask> {
  const parsed = asJson(value, null);
  if (parsed && typeof parsed === "object") {
    return parsed as ReturnType<typeof emptySlotMask>;
  }
  return emptySlotMask();
}

async function main(): Promise<void> {
  config({ path: ".env.local" });
  const { email, dbPath, force } = parseImportArgs(process.argv.slice(2));
  const result = await importSqlite({ dbPath, email, force });
  console.log(JSON.stringify(result));
}

const invoked =
  typeof process.argv[1] === "string" &&
  path.basename(process.argv[1]) ===
    path.basename(fileURLToPath(import.meta.url));

if (invoked) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
