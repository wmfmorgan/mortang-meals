"use server";

import { revalidatePath } from "next/cache";
import { normalizePeople } from "@/household/normalize-people";
import {
  acceptInvite,
  createInvite,
  removeMember,
  revokeInvite,
} from "@/household/members-repo";
import {
  getHouseholdForUser,
  replacePeople,
  upsertHousehold,
} from "@/household/repo";
import { seedKitchenIfEmpty } from "@/kitchen/repo";
import {
  requirePageHousehold,
  requirePageUser,
} from "@/lib/request-auth";
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

function actionError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
}

export async function saveHouseholdAction(input: HouseholdSaveInput) {
  const userId = await requirePageUser();
  const people = normalizePeople(input.people);

  const existing = await getHouseholdForUser(userId);
  const servingsRaw = input.servings.trim();
  const servings =
    servingsRaw === ""
      ? (existing?.servings ?? Math.max(1, people.length))
      : Number.parseInt(servingsRaw, 10) || Math.max(1, people.length);

  const household = existing
    ? await upsertHousehold({
        id: existing.id,
        ownerId: userId,
        name: input.name.trim(),
        dietStyle: input.dietStyle.trim(),
        notes: input.notes.trim(),
        servings,
      })
    : await upsertHousehold({
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

export async function createInviteAction(): Promise<
  | {
      ok: true;
      id: string;
      code: string;
      expiresAt: string;
      joinPath: string;
    }
  | { ok: false; error: string }
> {
  const { userId, householdId } = await requirePageHousehold();
  try {
    const invite = await createInvite(householdId, userId);
    revalidatePath("/household");
    return {
      ok: true,
      id: invite.id,
      code: invite.code,
      expiresAt: invite.expiresAt.toISOString(),
      joinPath: invite.joinPath,
    };
  } catch (error) {
    return { ok: false, error: actionError(error, "Couldn’t create invite.") };
  }
}

export async function revokeInviteAction(
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, householdId } = await requirePageHousehold();
  try {
    await revokeInvite(householdId, inviteId, userId);
    revalidatePath("/household");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionError(error, "Couldn’t revoke invite.") };
  }
}

export async function removeMemberAction(
  targetUserId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, householdId } = await requirePageHousehold();
  try {
    await removeMember(householdId, targetUserId, userId);
    revalidatePath("/household");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionError(error, "Couldn’t remove member.") };
  }
}

export async function acceptInviteAction(
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requirePageUser();
  try {
    await acceptInvite(code, userId);
    revalidatePath("/");
    revalidatePath("/household");
    revalidatePath("/setup");
    revalidatePath("/join");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: actionError(error, "Couldn’t accept invite.") };
  }
}
