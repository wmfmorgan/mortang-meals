import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { householdMembers, households } from "@/lib/schema";
import {
  createAuthUserWithoutHousehold,
  createTestIdentity,
  deleteTestUser,
} from "@/lib/test-identity";
import { getHouseholdForUser, replacePeople, upsertHousehold } from "./repo";

const users: string[] = [];
afterEach(async () => {
  await resetDbForTests();
  await Promise.all(users.splice(0).map(deleteTestUser));
});

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

    const member = await createAuthUserWithoutHousehold(
      `member-b-${crypto.randomUUID()}@example.com`,
    );
    users.push(member.userId);

    await getDb()
      .insert(householdMembers)
      .values({
        householdId: a.householdId,
        userId: member.userId,
        role: "member",
      });

    const seen = await getHouseholdForUser(member.userId);
    expect(seen?.id).toBe(a.householdId);
    expect(seen?.name).toBe("Shared");
  });

  it("upsertHousehold ensures an owner membership row", async () => {
    const user = await createAuthUserWithoutHousehold(
      `upsert-owner-${crypto.randomUUID()}@example.com`,
    );
    users.push(user.userId);

    const saved = await upsertHousehold({
      ownerId: user.userId,
      name: "Mortang",
      dietStyle: "omnivore",
      notes: "",
      servings: 2,
    });

    const rows = await getDb()
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, user.userId));
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
      id: ident.householdId,
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

  it("member B can save household fields without becoming a second owner", async () => {
    const owner = await createTestIdentity("owner-save@example.com");
    users.push(owner.userId);
    await upsertHousehold({
      ownerId: owner.userId,
      id: owner.householdId,
      name: "Shared",
      dietStyle: "omnivore",
      notes: "",
      servings: 2,
    });

    const member = await createAuthUserWithoutHousehold(
      `member-save-${crypto.randomUUID()}@example.com`,
    );
    users.push(member.userId);
    await getDb()
      .insert(householdMembers)
      .values({
        householdId: owner.householdId,
        userId: member.userId,
        role: "member",
      });

    // Mimic saveHouseholdAction passing the acting userId as ownerId.
    const updated = await upsertHousehold({
      id: owner.householdId,
      ownerId: member.userId,
      name: "Renamed by member",
      dietStyle: "omnivore",
      notes: "member notes",
      servings: 4,
    });

    expect(updated.id).toBe(owner.householdId);
    expect(updated.name).toBe("Renamed by member");
    expect(updated.servings).toBe(4);
    expect(updated.notes).toBe("member notes");

    const [row] = await getDb()
      .select()
      .from(households)
      .where(eq(households.id, owner.householdId));
    expect(row?.ownerId).toBe(owner.userId);

    const ownedByMember = await getDb()
      .select()
      .from(households)
      .where(eq(households.ownerId, member.userId));
    expect(ownedByMember).toHaveLength(0);

    const memberships = await getDb()
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, member.userId));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("member");
    expect(memberships[0]?.householdId).toBe(owner.householdId);
  });
});
