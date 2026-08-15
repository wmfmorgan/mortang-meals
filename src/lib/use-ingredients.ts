import type { UseIngredient } from "./types";

export const USE_INGREDIENTS_KEY = "mortang.useIngredients";

export function readUseIngredients(): UseIngredient[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(USE_INGREDIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UseIngredient[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeUseIngredients(items: UseIngredient[]) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(USE_INGREDIENTS_KEY, JSON.stringify(items));
}
