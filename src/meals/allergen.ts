import type { Ingredient } from "@/lib/types";

export function findAllergen(
  ingredients: Ingredient[],
  allergies: string[],
): string | null {
  const names = ingredients.map((i) => i.name.toLowerCase());

  for (const allergy of allergies) {
    if (!allergy) continue;
    const needle = allergy.toLowerCase();
    if (names.some((name) => name.includes(needle))) {
      return allergy;
    }
  }

  return null;
}
