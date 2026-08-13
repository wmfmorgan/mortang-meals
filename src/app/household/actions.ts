"use server";

import { revalidatePath } from "next/cache";
import { normalizePeople } from "@/household/normalize-people";
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

export async function saveHouseholdAction(input: HouseholdSaveInput) {
  const people = normalizePeople(input.people);

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
