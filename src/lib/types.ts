export type WeekSlot = "breakfast" | "lunch" | "dinner";
export type ExtraKind = "side" | "dessert";
export type MealSlot = WeekSlot | ExtraKind;
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
  | "extra"
  | "extra-retry"
  | "library"
  | "library-retry"
  | "test";
export type ExtraMode = "suggestion" | "recipe";
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
export const SLOTS: WeekSlot[] = ["breakfast", "lunch", "dinner"];
export const RECIPE_SLOTS: MealSlot[] = [
  "breakfast",
  "lunch",
  "dinner",
  "side",
  "dessert",
];
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
  sourceUrl?: string | null;
};

export type MealExtra = {
  id: string;
  kind: ExtraKind;
  mode: ExtraMode;
  title: string;
  whyItFits: string;
  cookMinutes: number;
  method: string;
  ingredients: Ingredient[];
  steps: string[];
  usedWebSearch: boolean;
  sourceUrl: string | null;
};

export type MealExtras = {
  side: MealExtra | null;
  dessert: MealExtra | null;
};

export type Meal = GeneratedMeal & {
  id: string;
  planId: string;
  usedWebSearch: boolean;
  pinned: boolean;
  createdAt: string;
  sourceUrl: string | null;
  extras: MealExtras;
  draft: boolean;
  stars: number;
  takeout: boolean;
  leftover: boolean;
};

export type LibraryMeal = {
  id: string;
  title: string;
  whyItFits: string;
  cookMinutes: number;
  method: string;
  slot: MealSlot;
  weekStart: string;
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

export type CookingExpertise = "newbie" | "novice" | "intermediate" | "expert";
export type InvolvedLevel = "low" | "medium" | "high";

export type KitchenPrefs = {
  expertise: CookingExpertise;
  overallDiet: string;
  breakfastDiet: string;
  lunchDiet: string;
  dinnerDiet: string;
  maxCookMinutes: number;
  involved: InvolvedLevel;
};

export type SlotMask = Record<DayOfWeek, Record<WeekSlot, boolean>>;

export type UseIngredient = {
  name: string;
  day: DayOfWeek;
  slot: WeekSlot;
};

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
