import { createClient } from "@supabase/supabase-js";
import { getDb } from "./db";
import { households } from "./schema";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createTestIdentity(email?: string): Promise<{
  userId: string;
  email: string;
  householdId: string;
}> {
  const resolvedEmail = email ?? `test-${crypto.randomUUID()}@example.com`;
  const { data, error } = await adminClient().auth.admin.createUser({
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
  return {
    userId: data.user.id,
    email: resolvedEmail,
    householdId: row.id,
  };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}
