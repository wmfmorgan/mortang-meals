import { redirect } from "next/navigation";
import { getHouseholdForUser } from "@/household/repo";
import { createClient } from "@/lib/supabase/server";
import type { Household } from "@/lib/types";

export type Authed = { userId: string; householdId: string };

export type HttpResult = { status: number; body: unknown };

const SIGN_IN = "Sign in to continue.";
const ADD_HOUSEHOLD = "Add a household before generating.";

function jsonError(status: number, message: string): HttpResult {
  return { status, body: { message } };
}

export async function requireUser(): Promise<
  { ok: true; userId: string } | { ok: false; result: HttpResult }
> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (typeof userId !== "string" || userId.length === 0) {
      return { ok: false, result: jsonError(401, SIGN_IN) };
    }
    return { ok: true, userId };
  } catch {
    return { ok: false, result: jsonError(401, SIGN_IN) };
  }
}

export async function requireHousehold(): Promise<
  | { ok: true; userId: string; householdId: string; household: Household }
  | { ok: false; result: HttpResult }
> {
  const user = await requireUser();
  if (!user.ok) return user;
  const household = await getHouseholdForUser(user.userId);
  if (!household) {
    return { ok: false, result: jsonError(400, ADD_HOUSEHOLD) };
  }
  return {
    ok: true,
    userId: user.userId,
    householdId: household.id,
    household,
  };
}

export async function resolveHandlerAuth(
  auth?: Authed,
): Promise<
  | { ok: true; userId: string; householdId: string; household: Household }
  | { ok: false; result: HttpResult }
> {
  if (auth) {
    const household = await getHouseholdForUser(auth.userId);
    if (!household) {
      return { ok: false, result: jsonError(400, ADD_HOUSEHOLD) };
    }
    return {
      ok: true,
      userId: auth.userId,
      householdId: household.id,
      household,
    };
  }
  return requireHousehold();
}

export async function requirePageUser(): Promise<string> {
  const result = await requireUser();
  if (!result.ok) redirect("/login");
  return result.userId;
}

export async function requirePageHousehold(): Promise<{
  userId: string;
  householdId: string;
  household: Household;
}> {
  const result = await requireHousehold();
  if (!result.ok) {
    if (result.result.status === 401) redirect("/login");
    redirect("/setup");
  }
  return result;
}
