import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  dietStyle: text("diet_style").notNull(),
  notes: text("notes").notNull(),
  servings: integer("servings").notNull(),
});

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  householdId: text("household_id").notNull(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  sex: text("sex"),
  allergiesJson: text("allergies_json").notNull(),
  avoidancesJson: text("avoidances_json").notNull(),
});

export const kitchenItems = sqliteTable("kitchen_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  enabled: integer("enabled").notNull(),
  builtIn: integer("built_in").notNull(),
});

export const weekPlans = sqliteTable("week_plans", {
  id: text("id").primaryKey(),
  weekStart: text("week_start").notNull(),
  isCurrent: integer("is_current").notNull(),
  slotMaskJson: text("slot_mask_json").notNull(),
});

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  planId: text("plan_id").notNull(),
  day: text("day").notNull(),
  slot: text("slot").notNull(),
  title: text("title").notNull(),
  whyItFits: text("why_it_fits").notNull(),
  cookMinutes: integer("cook_minutes").notNull(),
  method: text("method").notNull(),
  ingredientsJson: text("ingredients_json").notNull(),
  stepsJson: text("steps_json").notNull(),
  usedWebSearch: integer("used_web_search").notNull(),
});

export const aiSettings = sqliteTable("ai_settings", {
  id: text("id").primaryKey(),
  mode: text("mode").notNull(),
  baseUrl: text("base_url").notNull(),
  model: text("model").notNull(),
  customApiKey: text("custom_api_key"),
  developerTools: integer("developer_tools").notNull(),
  webSearch: integer("web_search").notNull(),
});

export const aiTraces = sqliteTable("ai_traces", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  kind: text("kind").notNull(),
  mode: text("mode").notNull(),
  baseUrl: text("base_url").notNull(),
  model: text("model").notNull(),
  requestText: text("request_text").notNull(),
  responseText: text("response_text").notNull(),
  validation: text("validation").notNull(),
});
