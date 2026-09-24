import type { Ingredient, Person } from "@/lib/types";
import { findAllergen } from "./allergen";

export function cookAllergenRibbon(
  people: Person[],
  ingredients: Ingredient[],
): { tone: "safe" | "alert"; text: string } {
  if (people.length === 0) {
    return { tone: "safe", text: "No household allergies on file." };
  }

  const hits = people.flatMap((person) => {
    const allergen = findAllergen(ingredients, person.allergies);
    return allergen ? [`Contains ${allergen} (${person.name})`] : [];
  });

  if (hits.length > 0) {
    return { tone: "alert", text: hits.join(" · ") };
  }

  const names = people.map((person) => person.name).join(", ");
  return { tone: "safe", text: `Allergen safe for ${names}.` };
}
