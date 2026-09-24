import { describe, expect, it } from "vitest";
import type { Ingredient, Person } from "@/lib/types";
import { cookAllergenRibbon } from "./cook-allergen";

const peanut: Ingredient = {
  name: "peanut butter",
  quantity: "2",
  unit: "tbsp",
  aisle: "pantry",
};

const rice: Ingredient = {
  name: "rice",
  quantity: "1",
  unit: "cup",
  aisle: "pantry",
};

function person(partial: Partial<Person> & Pick<Person, "name">): Person {
  return {
    id: partial.id ?? partial.name.toLowerCase(),
    age: 8,
    sex: null,
    allergies: [],
    avoidances: [],
    ...partial,
  };
}

describe("cookAllergenRibbon", () => {
  it("reports no household allergies when there are no people", () => {
    expect(cookAllergenRibbon([], [peanut])).toEqual({
      tone: "safe",
      text: "No household allergies on file.",
    });
  });

  it("is safe for a person with no allergy strings", () => {
    expect(cookAllergenRibbon([person({ name: "Ada" })], [peanut])).toEqual({
      tone: "safe",
      text: "Allergen safe for Ada.",
    });
  });

  it("alerts when a person's allergy hits an ingredient", () => {
    const ada = person({ name: "Ada", allergies: ["peanut"] });
    expect(cookAllergenRibbon([ada], [peanut])).toEqual({
      tone: "alert",
      text: "Contains peanut (Ada)",
    });
  });

  it("alerts only for the person whose allergy hits", () => {
    const ada = person({ name: "Ada", allergies: ["peanut"] });
    const bob = person({ name: "Bob", allergies: ["shrimp"] });
    expect(cookAllergenRibbon([ada, bob], [peanut])).toEqual({
      tone: "alert",
      text: "Contains peanut (Ada)",
    });
  });

  it("joins multiple hits with a middle dot", () => {
    const ada = person({ name: "Ada", allergies: ["peanut"] });
    const bob = person({ name: "Bob", allergies: ["shrimp"] });
    const shrimp: Ingredient = {
      name: "shrimp",
      quantity: "1",
      unit: "lb",
      aisle: "meat",
    };
    expect(cookAllergenRibbon([ada, bob], [peanut, shrimp])).toEqual({
      tone: "alert",
      text: "Contains peanut (Ada) · Contains shrimp (Bob)",
    });
  });

  it("is safe when people have allergies that miss the ingredients", () => {
    const ada = person({ name: "Ada", allergies: ["peanut"] });
    const bob = person({ name: "Bob", allergies: ["shrimp"] });
    expect(cookAllergenRibbon([ada, bob], [rice])).toEqual({
      tone: "safe",
      text: "Allergen safe for Ada, Bob.",
    });
  });

  it("ignores avoidances", () => {
    const ada = person({ name: "Ada", avoidances: ["peanut"] });
    expect(cookAllergenRibbon([ada], [peanut])).toEqual({
      tone: "safe",
      text: "Allergen safe for Ada.",
    });
  });
});
