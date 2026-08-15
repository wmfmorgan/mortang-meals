import type { Meal, MealSlot } from "@/lib/types";

export function mealDate(meal: Meal): string {
  return meal.createdAt.slice(0, 10);
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
  by: "slot" | "date" | "none",
): { key: string; label: string; meals: Meal[] }[] {
  if (by === "none") {
    return meals.length === 0 ? [] : [{ key: "all", label: "", meals }];
  }
  const labels: Record<string, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
  };
  const buckets = new Map<string, Meal[]>();
  for (const meal of meals) {
    const key = by === "slot" ? meal.slot : mealDate(meal);
    const list = buckets.get(key) ?? [];
    list.push(meal);
    buckets.set(key, list);
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (by === "slot") {
      const order = ["breakfast", "lunch", "dinner"];
      return order.indexOf(a) - order.indexOf(b);
    }
    return b.localeCompare(a);
  });
  return keys.map((key) => ({
    key,
    label: by === "slot" ? (labels[key] ?? key) : key,
    meals: buckets.get(key) ?? [],
  }));
}
