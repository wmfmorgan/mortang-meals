"use server";

import { revalidatePath } from "next/cache";
import { normalizePeople } from "@/household/normalize-people";
import {
  getHouseholdForUser,
  replacePeople,
  upsertHousehold,
} from "@/household/repo";
import { seedKitchenIfEmpty } from "@/kitchen/repo";
import { requirePageUser } from "@/lib/request-auth";
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
  const userId = await requirePageUser();
  const people = normalizePeople(input.people);

  const servingsRaw = input.servings.trim();
  const servings =
    servingsRaw === ""
      ? people.length
      : Number.parseInt(servingsRaw, 10) || people.length;

  const existing = await getHouseholdForUser(userId);
  const household = await upsertHousehold({
    ...(existing ? { id: existing.id } : {}),
    ownerId: userId,
    name: input.name.trim(),
    dietStyle: input.dietStyle.trim(),
    notes: input.notes.trim(),
    servings,
  });
  await seedKitchenIfEmpty(household.id);
  await replacePeople(household.id, people);

  revalidatePath("/");
  revalidatePath("/household");
  revalidatePath("/setup");
  return getHouseholdForUser(userId);
}
