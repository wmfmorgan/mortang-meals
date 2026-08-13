"use server";

import { revalidatePath } from "next/cache";
import { getHousehold, replacePeople, upsertHousehold } from "@/household/repo";
import type { Sex } from "@/lib/types";

export type HouseholdSaveInput = {
  name: string;
  dietStyle: string;
  notes: string;
  servings: string;
  people: {
    name: string;
    age: string;
    sex: "" | Sex;
    allergies: string;
    avoidances: string;
  }[];
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export async function saveHouseholdAction(input: HouseholdSaveInput) {
  const people = input.people.map((person) => ({
    name: person.name.trim(),
    age: Number.parseInt(person.age, 10) || 0,
    sex: person.sex === "" ? null : person.sex,
    allergies: splitCsv(person.allergies),
    avoidances: splitCsv(person.avoidances),
  }));

  const servingsRaw = input.servings.trim();
  const servings =
    servingsRaw === ""
      ? people.length
      : Number.parseInt(servingsRaw, 10) || people.length;

  const existing = getHousehold();
  const household = upsertHousehold({
    ...(existing ? { id: existing.id } : {}),
    name: input.name.trim(),
    dietStyle: input.dietStyle.trim(),
    notes: input.notes.trim(),
    servings,
  });
  replacePeople(household.id, people);

  revalidatePath("/");
  revalidatePath("/household");
  revalidatePath("/setup");
  return getHousehold();
}
