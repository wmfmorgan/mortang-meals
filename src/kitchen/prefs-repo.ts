import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { kitchenPrefs } from "@/lib/schema";
import type {
  CookingExpertise,
  InvolvedLevel,
  KitchenPrefs,
  MealSlot,
} from "@/lib/types";

const PREFS_ID = "default";

export const DEFAULT_KITCHEN_PREFS: KitchenPrefs = {
  expertise: "intermediate",
  overallDiet: "",
  breakfastDiet: "",
  lunchDiet: "",
  dinnerDiet: "",
  maxCookMinutes: 45,
  involved: "medium",
};

const EXPERTISE: CookingExpertise[] = [
  "newbie",
  "novice",
  "intermediate",
  "expert",
];
const INVOLVED: InvolvedLevel[] = ["low", "medium", "high"];

type PrefsRow = typeof kitchenPrefs.$inferSelect;

function asExpertise(value: string): CookingExpertise {
  return EXPERTISE.includes(value as CookingExpertise)
    ? (value as CookingExpertise)
    : DEFAULT_KITCHEN_PREFS.expertise;
}

function asInvolved(value: string): InvolvedLevel {
  return INVOLVED.includes(value as InvolvedLevel)
    ? (value as InvolvedLevel)
    : DEFAULT_KITCHEN_PREFS.involved;
}

function mapPrefs(row: PrefsRow): KitchenPrefs {
  return {
    expertise: asExpertise(row.expertise),
    overallDiet: row.overallDiet,
    breakfastDiet: row.breakfastDiet,
    lunchDiet: row.lunchDiet,
    dinnerDiet: row.dinnerDiet,
    maxCookMinutes: row.maxCookMinutes,
    involved: asInvolved(row.involved),
  };
}

function prefsValues(prefs: KitchenPrefs) {
  return {
    expertise: prefs.expertise,
    overallDiet: prefs.overallDiet,
    breakfastDiet: prefs.breakfastDiet,
    lunchDiet: prefs.lunchDiet,
    dinnerDiet: prefs.dinnerDiet,
    maxCookMinutes: prefs.maxCookMinutes,
    involved: prefs.involved,
  };
}

export function getKitchenPrefs(): KitchenPrefs {
  const db = getDb();
  const row = db.select().from(kitchenPrefs).get();
  if (row) return mapPrefs(row);
  db.insert(kitchenPrefs)
    .values({ id: PREFS_ID, ...prefsValues(DEFAULT_KITCHEN_PREFS) })
    .run();
  return { ...DEFAULT_KITCHEN_PREFS };
}

export function saveKitchenPrefs(patch: Partial<KitchenPrefs>): KitchenPrefs {
  const next = { ...getKitchenPrefs(), ...patch };
  if (next.maxCookMinutes < 5) next.maxCookMinutes = 5;
  const db = getDb();
  const row = db.select().from(kitchenPrefs).get();
  if (!row) {
    db.insert(kitchenPrefs)
      .values({ id: PREFS_ID, ...prefsValues(next) })
      .run();
    return next;
  }
  db.update(kitchenPrefs)
    .set(prefsValues(next))
    .where(eq(kitchenPrefs.id, row.id))
    .run();
  return next;
}

export function resolvedDiet(
  prefs: KitchenPrefs,
  slot: MealSlot,
  householdDiet: string,
): string {
  const bySlot =
    slot === "breakfast"
      ? prefs.breakfastDiet
      : slot === "lunch"
        ? prefs.lunchDiet
        : prefs.dinnerDiet;
  return bySlot.trim() || prefs.overallDiet.trim() || householdDiet.trim();
}
