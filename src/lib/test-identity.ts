import { getDb } from "./db";
import { householdMembers, households } from "./schema";
import { createAdminClient } from "./supabase/admin";

export async function createTestIdentity(email?: string): Promise<{
  userId: string;
  email: string;
  householdId: string;
}> {
  const resolvedEmail = email ?? `test-${crypto.randomUUID()}@example.com`;
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: resolvedEmail,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create test user");
  }
  const db = getDb();
  const [row] = await db
    .insert(households)
    .values({
      ownerId: data.user.id,
      name: "",
      dietStyle: "",
      notes: "",
      servings: 1,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to insert household");
  }
  await db.insert(householdMembers).values({
    householdId: row.id,
    userId: data.user.id,
    role: "owner",
  });
  return {
    userId: data.user.id,
    email: resolvedEmail,
    householdId: row.id,
  };
}

/** Auth user only — no households / membership rows. */
export async function createAuthUserWithoutHousehold(
  email?: string,
): Promise<{ userId: string; email: string }> {
  const resolvedEmail = email ?? `orphan-${crypto.randomUUID()}@example.com`;
  const { data, error } = await createAdminClient().auth.admin.createUser({
    email: resolvedEmail,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create auth user");
  }
  return { userId: data.user.id, email: resolvedEmail };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await createAdminClient().auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
