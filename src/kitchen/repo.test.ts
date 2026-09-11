import { afterEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { BUILTIN_KITCHEN_ITEMS } from "./defaults";
import { listKitchen, seedKitchenIfEmpty } from "./repo";

const users: string[] = [];
afterEach(async () => {
  await resetDbForTests();
  await Promise.all(users.splice(0).map(deleteTestUser));
});

describe("kitchen repo", () => {
  it("seedKitchenIfEmpty does not populate another household", async () => {
    const a = await createTestIdentity();
    const b = await createTestIdentity();
    users.push(a.userId, b.userId);
    await seedKitchenIfEmpty(a.householdId);
    const mine = await listKitchen(a.householdId);
    const other = await listKitchen(b.householdId);
    expect(mine).toHaveLength(BUILTIN_KITCHEN_ITEMS.length);
    expect(other).toEqual([]);
  });
});
