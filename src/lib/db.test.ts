import { afterAll, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "./db";
import { households } from "./schema";
import { createTestIdentity, deleteTestUser } from "./test-identity";

describe("postgres db", () => {
  let userId = "";
  afterAll(async () => {
    if (userId) await deleteTestUser(userId);
    await resetDbForTests();
  });

  it("createTestIdentity inserts a household owned by that user", async () => {
    const ident = await createTestIdentity();
    userId = ident.userId;
    const db = getDb();
    const rows = await db.select().from(households);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ownerId).toBe(ident.userId);
    expect(ident.householdId).toBe(rows[0]?.id);
  });
});
