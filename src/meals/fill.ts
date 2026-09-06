import type { DayOfWeek, Meal, MealSlot, SlotMask, WeekSlot } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { findAllergen } from "./allergen";
import { isDuplicateTitle } from "./duplicates";
import { mealProtein, type Protein } from "./protein";

/** Dinner before lunch so leftover lunches can copy dinners filled in this pass. */
const FILL_ORDER: WeekSlot[] = ["breakfast", "dinner", "lunch"];

export type FillPick = {
  day: DayOfWeek;
  slot: MealSlot;
  source: Meal;
  leftover: boolean;
};

function previousDay(day: DayOfWeek): DayOfWeek | null {
  const index = DAYS.indexOf(day);
  if (index <= 0) return null;
  return DAYS[index - 1]!;
}

function occupant(
  day: DayOfWeek,
  slot: MealSlot,
  occupied: Meal[],
  picks: FillPick[],
): Meal | FillPick["source"] | null {
  const existing = occupied.find((meal) => meal.day === day && meal.slot === slot);
  if (existing) return existing;
  return picks.find((pick) => pick.day === day && pick.slot === slot)?.source ?? null;
}

function isTakeout(meal: Meal | FillPick["source"]): boolean {
  return Boolean("takeout" in meal && meal.takeout);
}

function isLeftover(meal: Meal | FillPick["source"]): boolean {
  return Boolean("leftover" in meal && meal.leftover);
}

function emptyProteinCounts(): Map<MealSlot, Map<Protein, number>> {
  return new Map(SLOTS.map((slot) => [slot, new Map<Protein, number>()]));
}

export function pickFillMeals(input: {
  mask: SlotMask;
  occupied: Meal[];
  library: Meal[];
  allergies: string[];
  maxCookMinutes: number;
  allowRepeats: boolean;
  leftoverLunches: boolean;
  maxProtein: number;
}): FillPick[] {
  const picks: FillPick[] = [];
  const usedTitles = new Map<MealSlot, string[]>(
    SLOTS.map((slot) => [slot, [] as string[]]),
  );
  const proteinCounts = emptyProteinCounts();
  for (const meal of input.occupied) {
    if (meal.takeout) continue;
    usedTitles.get(meal.slot)!.push(meal.title);
    if (meal.leftover) continue;
    const protein = mealProtein(meal.ingredients);
    if (protein) {
      const counts = proteinCounts.get(meal.slot)!;
      counts.set(protein, (counts.get(protein) ?? 0) + 1);
    }
  }

  function titlesFor(slot: MealSlot): string[] {
    return usedTitles.get(slot)!;
  }

  function wouldExceedProtein(
    slot: MealSlot,
    ingredients: Meal["ingredients"],
  ): boolean {
    if (input.maxProtein <= 0) return false;
    const protein = mealProtein(ingredients);
    if (!protein) return false;
    return (proteinCounts.get(slot)!.get(protein) ?? 0) >= input.maxProtein;
  }

  function record(pick: FillPick) {
    picks.push(pick);
    usedTitles.get(pick.slot)!.push(pick.source.title);
    if (pick.leftover) return;
    const protein = mealProtein(pick.source.ingredients);
    if (protein) {
      const counts = proteinCounts.get(pick.slot)!;
      counts.set(protein, (counts.get(protein) ?? 0) + 1);
    }
  }

  function eligibleLibrary(slot: MealSlot, taken: string[], honorCookTime: boolean) {
    return input.library.filter(
      (meal) =>
        meal.slot === slot &&
        !meal.draft &&
        !meal.takeout &&
        !meal.leftover &&
        !findAllergen(meal.ingredients, input.allergies) &&
        (input.allowRepeats || !isDuplicateTitle(meal.title, taken)) &&
        !wouldExceedProtein(slot, meal.ingredients) &&
        (!honorCookTime || meal.cookMinutes <= input.maxCookMinutes),
    );
  }

  for (const slot of FILL_ORDER) {
    for (const day of DAYS) {
      if (!input.mask[day][slot]) continue;
      if (input.occupied.some((meal) => meal.day === day && meal.slot === slot)) {
        continue;
      }

      if (input.leftoverLunches && slot === "lunch") {
        const prev = previousDay(day);
        const dinner = prev
          ? occupant(prev, "dinner", input.occupied, picks)
          : null;
        if (
          dinner &&
          !isTakeout(dinner) &&
          !isLeftover(dinner) &&
          !wouldExceedProtein("lunch", dinner.ingredients)
        ) {
          record({ day, slot, source: dinner as Meal, leftover: true });
          continue;
        }
      }

      const taken = titlesFor(slot);
      const underCap = eligibleLibrary(slot, taken, true);
      const pool =
        underCap.length > 0 ? underCap : eligibleLibrary(slot, taken, false);
      const sorted = [...pool].sort((a, b) => {
        const aUsed = isDuplicateTitle(a.title, taken) ? 1 : 0;
        const bUsed = isDuplicateTitle(b.title, taken) ? 1 : 0;
        if (aUsed !== bUsed) return aUsed - bUsed;
        if (b.stars !== a.stars) return b.stars - a.stars;
        return b.createdAt.localeCompare(a.createdAt);
      });
      const source = sorted[0];
      if (!source) continue;
      record({ day, slot, source, leftover: false });
    }
  }

  return picks;
}
