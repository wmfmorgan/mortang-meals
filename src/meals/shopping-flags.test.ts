import { describe, expect, it } from "vitest";
import type { Person } from "@/lib/types";
import { itemHitsAllergies, shoppingItemFlags } from "./shopping-flags";

function person(partial: Partial<Person> & { name: string }): Person {
  return {
    id: partial.id ?? partial.name.toLowerCase(),
    name: partial.name,
    age: partial.age ?? 10,
    sex: partial.sex ?? null,
    allergies: partial.allergies ?? [],
    avoidances: partial.avoidances ?? [],
  };
}

describe("shoppingItemFlags", () => {
  it("flags an ingredient that contains a person's allergy", () => {
    const maya = person({ name: "Maya", allergies: ["soy"] });
    expect(shoppingItemFlags("soy sauce", [maya])).toEqual([
      {
        personId: "maya",
        personName: "Maya",
        term: "soy",
        kind: "allergy",
      },
    ]);
  });

  it("does not treat oat milk as dairy", () => {
    const will = person({ name: "Will", avoidances: ["milk"] });
    expect(shoppingItemFlags("oat milk", [will])).toEqual([]);
  });

  it("ignores a person with a blank name", () => {
    const blank = person({ id: "x", name: "  ", allergies: ["soy"] });
    expect(shoppingItemFlags("soy sauce", [blank])).toEqual([]);
  });

  it("keeps the allergy flag when the same term is also an avoidance", () => {
    const maya = person({
      name: "Maya",
      allergies: ["soy"],
      avoidances: ["soy"],
    });
    expect(shoppingItemFlags("soy sauce", [maya])).toEqual([
      {
        personId: "maya",
        personName: "Maya",
        term: "soy",
        kind: "allergy",
      },
    ]);
  });
});

describe("itemHitsAllergies", () => {
  it("is true when the ingredient name contains an allergy", () => {
    expect(itemHitsAllergies("peanut butter", ["peanut"])).toBe(true);
  });

  it("is false when nothing matches", () => {
    expect(itemHitsAllergies("olive oil", ["peanut"])).toBe(false);
  });
});
