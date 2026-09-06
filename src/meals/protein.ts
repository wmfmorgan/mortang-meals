import type { Ingredient } from "@/lib/types";

export const PROTEINS = [
  "chicken",
  "turkey",
  "beef",
  "pork",
  "ham",
  "bacon",
  "sausage",
  "lamb",
  "salmon",
  "tuna",
  "shrimp",
  "cod",
  "tofu",
  "tempeh",
  "egg",
] as const;

export type Protein = (typeof PROTEINS)[number];

export function mealProtein(
  ingredients: Pick<Ingredient, "name">[],
): Protein | null {
  const blob = ingredients.map((item) => item.name.toLowerCase()).join(" ");
  for (const protein of PROTEINS) {
    const pattern = new RegExp(`\\b${protein}s?\\b`);
    if (pattern.test(blob)) return protein;
  }
  return null;
}
