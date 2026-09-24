import type { Ingredient, Person } from "@/lib/types";
import { findAllergen, findDietExclude } from "./allergen";

export type ShoppingFlag = {
  personId: string;
  personName: string;
  term: string;
  kind: "allergy" | "avoidance";
};

function asIngredients(itemName: string): Ingredient[] {
  return [{ name: itemName, quantity: "1", unit: "", aisle: "other" }];
}

export function itemHitsAllergies(
  itemName: string,
  allergies: string[],
): boolean {
  return findAllergen(asIngredients(itemName), allergies) != null;
}

export function shoppingItemFlags(
  itemName: string,
  people: Person[],
): ShoppingFlag[] {
  const ingredients = asIngredients(itemName);
  const flags: ShoppingFlag[] = [];
  for (const person of people) {
    if (!person.name.trim()) continue;
    const allergy = findAllergen(ingredients, person.allergies);
    if (allergy) {
      flags.push({
        personId: person.id,
        personName: person.name,
        term: allergy,
        kind: "allergy",
      });
    }
    const avoidance = findDietExclude(ingredients, person.avoidances);
    if (avoidance && avoidance.toLowerCase() !== allergy?.toLowerCase()) {
      flags.push({
        personId: person.id,
        personName: person.name,
        term: avoidance,
        kind: "avoidance",
      });
    }
  }
  return flags;
}
