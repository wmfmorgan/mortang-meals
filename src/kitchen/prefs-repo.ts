import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { kitchenPrefs } from "@/lib/schema";
import type {
  CookingExpertise,
  InvolvedLevel,
  KitchenPrefs,
  MealSlot,
} from "@/lib/types";

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

export async function getKitchenPrefs(
  householdId: string,
): Promise<KitchenPrefs> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(kitchenPrefs)
    .where(eq(kitchenPrefs.householdId, householdId))
    .limit(1);
  if (row) return mapPrefs(row);
  await db.insert(kitchenPrefs).values({
    householdId,
    ...prefsValues(DEFAULT_KITCHEN_PREFS),
  });
  return { ...DEFAULT_KITCHEN_PREFS };
}

export async function saveKitchenPrefs(
  householdId: string,
  patch: Partial<KitchenPrefs>,
): Promise<KitchenPrefs> {
  const next = { ...(await getKitchenPrefs(householdId)), ...patch };
  if (next.maxCookMinutes < 5) next.maxCookMinutes = 5;
  const db = getDb();
  const [row] = await db
    .select()
    .from(kitchenPrefs)
    .where(eq(kitchenPrefs.householdId, householdId))
    .limit(1);
  if (!row) {
    await db.insert(kitchenPrefs).values({
      householdId,
      ...prefsValues(next),
    });
    return next;
  }
  await db
    .update(kitchenPrefs)
    .set(prefsValues(next))
    .where(eq(kitchenPrefs.householdId, householdId));
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
