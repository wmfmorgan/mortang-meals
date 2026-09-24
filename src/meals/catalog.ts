import type { Meal, MealSlot } from "@/lib/types";
import { findAllergen } from "./allergen";
import { normalizeTitle } from "./duplicates";

export type CatalogGroupBy = "slot" | "date" | "method" | "none";
export type CatalogSort = "loved" | "recent" | "fast";
export type CatalogChip = "all" | "safe" | "quick" | "sheet" | "slow";

export function normalizeMethod(method: string): string {
  const key = method.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return key || "other";
}

export function sortCatalogMeals(meals: Meal[], by: CatalogSort): Meal[] {
  const copy = [...meals];
  copy.sort((a, b) => {
    if (by === "loved") {
      if (b.stars !== a.stars) return b.stars - a.stars;
    } else if (by === "fast") {
      if (a.cookMinutes !== b.cookMinutes) return a.cookMinutes - b.cookMinutes;
    }
    return b.createdAt.localeCompare(a.createdAt) || a.title.localeCompare(b.title);
  });
  return copy;
}

export function mealMatchesChip(
  meal: Meal,
  chip: CatalogChip,
  allergies: string[],
): boolean {
  if (chip === "all") return true;
  if (chip === "quick") return meal.cookMinutes <= 20;
  if (chip === "sheet") {
    return /sheet|skillet|stovetop/.test(normalizeMethod(meal.method));
  }
  if (chip === "slow") {
    return /slow cook|crock|instant pot/.test(normalizeMethod(meal.method));
  }
  if (chip === "safe") return !findAllergen(meal.ingredients, allergies);
  return true;
}

export function mealDate(meal: Meal): string {
  return meal.createdAt.slice(0, 10);
}

export function uniqueCatalogMeals(meals: Meal[]): Meal[] {
  const eligible = meals.filter(
    (meal) => !meal.draft && !meal.takeout && !meal.leftover,
  );
  const ranked = [...eligible].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
  });
  const seen = new Set<string>();
  const unique: Meal[] = [];
  for (const meal of ranked) {
    const key = normalizeTitle(meal.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(meal);
  }
  return unique.sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export function filterCatalogMeals(
  meals: Meal[],
  query: {
    search?: string;
    slot?: MealSlot | "all";
    date?: string | "all";
  },
): Meal[] {
  const search = query.search?.trim().toLowerCase() ?? "";
  return meals.filter((meal) => {
    if (query.slot && query.slot !== "all" && meal.slot !== query.slot) {
      return false;
    }
    if (query.date && query.date !== "all" && mealDate(meal) !== query.date) {
      return false;
    }
    if (!search) return true;
    const hay = [
      meal.title,
      meal.whyItFits,
      meal.method,
      ...meal.ingredients.map((item) => item.name),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(search);
  });
}

export function groupCatalogMeals(
  meals: Meal[],
  by: CatalogGroupBy,
): { key: string; label: string; meals: Meal[] }[] {
  if (by === "none") {
    return meals.length === 0 ? [] : [{ key: "all", label: "", meals }];
  }
  const labels: Record<string, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    side: "Side",
    dessert: "Dessert",
  };
  const buckets = new Map<string, Meal[]>();
  for (const meal of meals) {
    const key =
      by === "slot"
        ? meal.slot
        : by === "method"
          ? normalizeMethod(meal.method)
          : mealDate(meal);
    const list = buckets.get(key) ?? [];
    list.push(meal);
    buckets.set(key, list);
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (by === "slot") {
      const order = ["breakfast", "lunch", "dinner", "side", "dessert"];
      return order.indexOf(a) - order.indexOf(b);
    }
    if (by === "method") {
      if (a === "other") return 1;
      if (b === "other") return -1;
      return a.localeCompare(b);
    }
    return b.localeCompare(a);
  });
  return keys.map((key) => ({
    key,
    label:
      by === "slot"
        ? (labels[key] ?? key)
        : by === "method"
          ? methodGroupLabel(key)
          : key,
    meals: buckets.get(key) ?? [],
  }));
}

function methodGroupLabel(key: string): string {
  return key.replace(/\b\w/g, (char) => char.toUpperCase());
}
