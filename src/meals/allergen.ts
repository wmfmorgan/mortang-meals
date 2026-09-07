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

const PLANT_BASED_EXCEPTIONS: { term: string; skip: RegExp }[] = [
  {
    term: "butter",
    skip: /\b(peanut|almond|cashew|sunflower|sesame|seed|nut|cookie|apple|cocoa)\s+butters?\b/i,
  },
  {
    term: "milk",
    skip: /\b(coconut|almond|oat|soy|rice|hemp|cashew|pea|flax|macadamia)\s+milks?\b/i,
  },
  {
    term: "cream",
    skip: /\b(coconut\s+creams?|cream of tartar)\b/i,
  },
  {
    term: "yogurt",
    skip: /\b(coconut|almond|oat|soy|cashew)\s+yogurts?\b/i,
  },
  {
    term: "yoghurt",
    skip: /\b(coconut|almond|oat|soy|cashew)\s+yoghurts?\b/i,
  },
];

function nameHitsDietTerm(name: string, term: string): boolean {
  const needle = term.toLowerCase();
  if (!name.includes(needle)) return false;
  return !PLANT_BASED_EXCEPTIONS.some(
    (item) => item.term === needle && item.skip.test(name),
  );
}

/** Diet/avoidance excludes. Plant milks and nut butters are not dairy. */
export function findDietExclude(
  ingredients: Ingredient[],
  terms: string[],
): string | null {
  const names = ingredients.map((item) => item.name.toLowerCase());
  for (const term of terms) {
    if (!term) continue;
    if (names.some((name) => nameHitsDietTerm(name, term))) return term;
  }
  return null;
}
