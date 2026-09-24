import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { householdMembers } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { getHouseholdForUser, replacePeople, upsertHousehold } from "./repo";

const users: string[] = [];
afterEach(async () => {
  await resetDbForTests();
  await Promise.all(users.splice(0).map(deleteTestUser));
});

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

describe("household repo", () => {
  it("does not return another user's household", async () => {
    const a = await createTestIdentity("a@example.com");
    const b = await createTestIdentity("b@example.com");
    users.push(a.userId, b.userId);
    await upsertHousehold({
      ownerId: a.userId,
      id: a.householdId,
      name: "A",
      dietStyle: "omnivore",
      notes: "",
      servings: 2,
    });
    const seen = await getHouseholdForUser(b.userId);
    expect(seen?.name ?? "").not.toBe("A");
  });

  it("member B resolves owner A's household via membership", async () => {
    const a = await createTestIdentity("owner-a@example.com");
    users.push(a.userId);
    await upsertHousehold({
      ownerId: a.userId,
      id: a.householdId,
      name: "Shared",
      dietStyle: "omnivore",
      notes: "",
      servings: 2,
    });

    const email = `member-b-${crypto.randomUUID()}@example.com`;
    const { data, error } = await adminClient().auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Failed to create member user");
    }
    users.push(data.user.id);

    await getDb()
      .insert(householdMembers)
      .values({
        householdId: a.householdId,
        userId: data.user.id,
        role: "member",
      });

    const seen = await getHouseholdForUser(data.user.id);
    expect(seen?.id).toBe(a.householdId);
    expect(seen?.name).toBe("Shared");
  });

  it("upsertHousehold ensures an owner membership row", async () => {
    const email = `upsert-owner-${crypto.randomUUID()}@example.com`;
    const { data, error } = await adminClient().auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(error?.message ?? "Failed to create upsert user");
    }
    users.push(data.user.id);

    const saved = await upsertHousehold({
      ownerId: data.user.id,
      name: "Mortang",
      dietStyle: "omnivore",
      notes: "",
      servings: 2,
    });

    const rows = await getDb()
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, data.user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.householdId).toBe(saved.id);
    expect(rows[0]?.role).toBe("owner");
  });

  it("replacePeople is scoped to that household", async () => {
    const ident = await createTestIdentity();
    users.push(ident.userId);
    await replacePeople(ident.householdId, [
      { name: "Alex", age: 53, sex: "male", allergies: ["shellfish"], avoidances: [] },
    ]);
    const household = await getHouseholdForUser(ident.userId);
    expect(household?.people.map((p) => p.name)).toEqual(["Alex"]);
    expect(household?.people[0]?.allergies).toEqual(["shellfish"]);
  });

  it("upsertHousehold updates the existing owner row", async () => {
    const ident = await createTestIdentity();
    users.push(ident.userId);
    const saved = await upsertHousehold({
      ownerId: ident.userId,
      name: "Mortang",
      dietStyle: "omnivore",
      notes: "",
      servings: 2,
    });
    expect(saved.id).toBe(ident.householdId);
    expect(saved.name).toBe("Mortang");
    const again = await getHouseholdForUser(ident.userId);
    expect(again?.id).toBe(ident.householdId);
    expect(again?.name).toBe("Mortang");
  });
});
