import type { Ingredient } from "@/lib/types";
import { formatQuantity, parseQuantity } from "./shopping-list";

export function scaleIngredients(
  ingredients: Ingredient[],
  fromServings: number,
  toServings: number,
): Ingredient[] {
  const from = fromServings >= 1 ? fromServings : 1;
  const to = toServings >= 1 ? toServings : 1;
  const ratio = to / from;
  return ingredients.map((item) => {
    const parsed = parseQuantity(item.quantity);
    if (parsed == null) return item;
    return { ...item, quantity: formatQuantity(parsed * ratio) };
  });
}
