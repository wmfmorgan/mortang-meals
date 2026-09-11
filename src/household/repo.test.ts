import { afterEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
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
