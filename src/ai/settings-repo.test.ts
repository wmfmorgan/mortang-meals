import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { households } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { getSettings, saveSettings } from "./settings-repo";

let ident: Awaited<ReturnType<typeof createTestIdentity>>;
const extraUsers: string[] = [];

beforeAll(async () => {
  ident = await createTestIdentity();
});

afterEach(async () => {
  await Promise.all(extraUsers.splice(0).map(deleteTestUser));
  await resetDbForTests();
  const [row] = await getDb()
    .insert(households)
    .values({
      ownerId: ident.userId,
      name: "",
      dietStyle: "",
      notes: "",
      servings: 1,
    })
    .returning();
  ident.householdId = row!.id;
});

afterAll(async () => {
  await resetDbForTests();
  await deleteTestUser(ident.userId);
});

describe("settings repo", () => {
  it("defaults web search to off and persists the toggle", async () => {
    expect((await getSettings(ident.householdId)).webSearch).toBe(false);
    expect((await saveSettings(ident.householdId, { webSearch: true })).webSearch).toBe(
      true,
    );
    expect((await getSettings(ident.householdId)).webSearch).toBe(true);
    expect((await saveSettings(ident.householdId, { webSearch: false })).webSearch).toBe(
      false,
    );
  });

  it("two households have independent model", async () => {
    const other = await createTestIdentity();
    extraUsers.push(other.userId);
    await saveSettings(ident.householdId, { model: "grok-a" });
    await saveSettings(other.householdId, { model: "grok-b" });
    expect((await getSettings(ident.householdId)).model).toBe("grok-a");
    expect((await getSettings(other.householdId)).model).toBe("grok-b");
  });
});
