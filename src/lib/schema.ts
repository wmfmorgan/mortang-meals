import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { Ingredient, MealExtras, SlotMask } from "./types";

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().unique(),
  name: text("name").notNull(),
  dietStyle: text("diet_style").notNull(),
  notes: text("notes").notNull(),
  servings: integer("servings").notNull(),
});

export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  sex: text("sex"),
  allergies: jsonb("allergies").$type<string[]>().notNull(),
  avoidances: jsonb("avoidances").$type<string[]>().notNull(),
});

export const kitchenPrefs = pgTable("kitchen_prefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().unique(),
  expertise: text("expertise").notNull(),
  overallDiet: text("overall_diet").notNull(),
  breakfastDiet: text("breakfast_diet").notNull(),
  lunchDiet: text("lunch_diet").notNull(),
  dinnerDiet: text("dinner_diet").notNull(),
  maxCookMinutes: integer("max_cook_minutes").notNull(),
  involved: text("involved").notNull(),
});

export const kitchenItems = pgTable("kitchen_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  enabled: boolean("enabled").notNull(),
  builtIn: boolean("built_in").notNull(),
});

export const weekPlans = pgTable("week_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull(),
  weekStart: text("week_start").notNull(),
  isCurrent: boolean("is_current").notNull(),
  slotMask: jsonb("slot_mask").$type<SlotMask>().notNull(),
  name: text("name").notNull().default(""),
  favorited: boolean("favorited").notNull().default(false),
});

export const meals = pgTable("meals", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull(),
  planId: uuid("plan_id"),
  day: text("day").notNull(),
  slot: text("slot").notNull(),
  title: text("title").notNull(),
  whyItFits: text("why_it_fits").notNull(),
  cookMinutes: integer("cook_minutes").notNull(),
  method: text("method").notNull(),
  ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull(),
  steps: jsonb("steps").$type<string[]>().notNull(),
  usedWebSearch: boolean("used_web_search").notNull().default(false),
  pinned: boolean("pinned").notNull().default(false),
  weekStart: text("week_start").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  sourceUrl: text("source_url"),
  extras: jsonb("extras").$type<MealExtras>().notNull(),
  draft: boolean("draft").notNull().default(false),
  stars: smallint("stars").notNull().default(0),
  takeout: boolean("takeout").notNull().default(false),
  leftover: boolean("leftover").notNull().default(false),
});

export const libraryGeneratePrefs = pgTable("library_generate_prefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().unique(),
  json: jsonb("json").notNull(),
});

export const aiSettings = pgTable("ai_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull().unique(),
  mode: text("mode").notNull(),
  baseUrl: text("base_url").notNull(),
  model: text("model").notNull(),
  customApiKey: text("custom_api_key"),
  developerTools: boolean("developer_tools").notNull(),
  webSearch: boolean("web_search").notNull(),
});

export const aiTraces = pgTable("ai_traces", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  kind: text("kind").notNull(),
  mode: text("mode").notNull(),
  baseUrl: text("base_url").notNull(),
  model: text("model").notNull(),
  requestText: text("request_text").notNull(),
  responseText: text("response_text").notNull(),
  validation: text("validation").notNull(),
});

export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: uuid("user_id").notNull(),
    day: date("day").notNull(),
    generateCount: integer("generate_count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })],
);
