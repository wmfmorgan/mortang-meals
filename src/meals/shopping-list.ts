import { AISLES, type Meal, type ShoppingItem, type ShoppingList } from "@/lib/types";

export function normalizeIngredientName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const words = normalized.split(" ");
  const last = words[words.length - 1];
  if (last && last.length > 3 && last.endsWith("s") && !last.endsWith("ss")) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(" ");
}

export function mergeShoppingList(
  meals: Pick<Meal, "ingredients">[],
): ShoppingList {
  const merged = new Map<string, ShoppingItem>();

  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      const name = normalizeIngredientName(ingredient.name);
      const key = `${name}|${ingredient.unit}`;
      const existing = merged.get(key);
      if (existing) {
        existing.quantity += ingredient.quantity;
      } else {
        merged.set(key, {
          name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          aisle: ingredient.aisle,
        });
      }
    }
  }

  const byAisle = new Map<string, ShoppingItem[]>();
  for (const item of merged.values()) {
    const items = byAisle.get(item.aisle) ?? [];
    items.push(item);
    byAisle.set(item.aisle, items);
  }

  return AISLES.filter((aisle) => byAisle.has(aisle)).map((aisle) => ({
    aisle,
    items: byAisle.get(aisle)!,
  }));
}
