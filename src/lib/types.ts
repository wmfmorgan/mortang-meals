export type MealSlot = "breakfast" | "lunch" | "dinner";
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export type Aisle = "produce" | "meat" | "dairy" | "pantry" | "other";
export type Sex = "male" | "female" | "other";
export type ProviderMode = "grok" | "custom";
export type TraceKind =
  | "generate"
  | "generate-retry"
  | "swap"
  | "swap-retry"
  | "test";
export type ValidationResult =
  | "ok"
  | "invalid-json"
  | "schema"
  | "allergen"
  | "duplicate"
  | "transport";

export const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
export const AISLES: Aisle[] = ["produce", "meat", "dairy", "pantry", "other"];

export type Ingredient = {
  name: string;
  quantity: string;
  unit: string;
  aisle: Aisle;
};

export type GeneratedMeal = {
  day: DayOfWeek;
  slot: MealSlot;
  title: string;
  whyItFits: string;
  cookMinutes: number;
  method: string;
  ingredients: Ingredient[];
  steps: string[];
};

export type Meal = GeneratedMeal & {
  id: string;
  planId: string;
  usedWebSearch: boolean;
};

export type Person = {
  id: string;
  name: string;
  age: number;
  sex: Sex | null;
  allergies: string[];
  avoidances: string[];
};

export type Household = {
  id: string;
  name: string;
  dietStyle: string;
  notes: string;
  servings: number;
  people: Person[];
};

export type KitchenItem = {
  id: string;
  name: string;
  kind: "appliance" | "method";
  enabled: boolean;
  builtIn: boolean;
};

export type SlotMask = Record<DayOfWeek, Record<MealSlot, boolean>>;

export type WeekPlan = {
  id: string;
  weekStart: string;
  isCurrent: boolean;
  slotMask: SlotMask;
  meals: Meal[];
};

export type ShoppingItem = {
  name: string;
  quantity: string;
  unit: string;
  aisle: Aisle;
};

export type ShoppingList = { aisle: Aisle; items: ShoppingItem[] }[];

export type AiSettings = {
  mode: ProviderMode;
  baseUrl: string;
  model: string;
  customApiKey: string | null;
  developerTools: boolean;
  webSearch: boolean;
};

export type AiTrace = {
  id: string;
  createdAt: string;
  kind: TraceKind;
  mode: ProviderMode;
  baseUrl: string;
  model: string;
  requestText: string;
  responseText: string;
  validation: ValidationResult;
};

export type ChatMessage = { role: "system" | "user"; content: string };

export type AdapterRequest = {
  messages: ChatMessage[];
  jsonSchema: Record<string, unknown>;
  schemaName: string;
  signal?: AbortSignal;
};

export type AdapterResult =
  | { ok: true; text: string }
  | { ok: false; error: string };
