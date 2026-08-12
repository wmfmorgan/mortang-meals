import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

function resolveDbPath(): string {
  if (process.env.MORTANG_DB_PATH) {
    return process.env.MORTANG_DB_PATH;
  }
  return path.join(process.cwd(), "data", "mortang.db");
}

function ensureSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      diet_style TEXT NOT NULL,
      notes TEXT NOT NULL,
      servings INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      sex TEXT,
      allergies_json TEXT NOT NULL,
      avoidances_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kitchen_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      built_in INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS week_plans (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL,
      is_current INTEGER NOT NULL,
      slot_mask_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      day TEXT NOT NULL,
      slot TEXT NOT NULL,
      title TEXT NOT NULL,
      why_it_fits TEXT NOT NULL,
      cook_minutes INTEGER NOT NULL,
      method TEXT NOT NULL,
      ingredients_json TEXT NOT NULL,
      steps_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      custom_api_key TEXT,
      developer_tools INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_traces (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      kind TEXT NOT NULL,
      mode TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      request_text TEXT NOT NULL,
      response_text TEXT NOT NULL,
      validation TEXT NOT NULL
    );
  `);
}

export function getDb() {
  const dbPath = resolveDbPath();
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  ensureSchema(sqlite);
  return drizzle(sqlite, { schema });
}
