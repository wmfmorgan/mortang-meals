import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { households } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { getSettings, saveSettings } from "./settings-repo";

let ident: Awaited<ReturnType<typeof createTestIdentity>>;
const extraUsers: string[] = [];

async function reseedHousehold() {
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
}

beforeAll(async () => {
  ident = await createTestIdentity();
});

beforeEach(async () => {
  await Promise.all(extraUsers.splice(0).map(deleteTestUser));
  await reseedHousehold();
});

afterEach(async () => {
  await Promise.all(extraUsers.splice(0).map(deleteTestUser));
});

afterAll(async () => {
  await resetDbForTests();
  await deleteTestUser(ident.userId);
});

describe("settings repo", () => {
  it("defaults web search to off and persists the toggle globally", async () => {
    expect((await getSettings(ident.householdId)).webSearch).toBe(false);
    expect((await saveSettings(ident.householdId, { webSearch: true })).webSearch).toBe(
      true,
    );
    expect((await getSettings(ident.householdId)).webSearch).toBe(true);
    expect((await saveSettings(ident.householdId, { webSearch: false })).webSearch).toBe(
      false,
    );
  });

  it("defaults reasoning effort to high and persists globally", async () => {
    expect((await getSettings(ident.householdId)).reasoningEffort).toBe("high");
    expect(
      (await saveSettings(ident.householdId, { reasoningEffort: "low" }))
        .reasoningEffort,
    ).toBe("low");
    expect((await getSettings(ident.householdId)).reasoningEffort).toBe("low");
  });

  it("shares provider settings across households but keeps developer tools local", async () => {
    const other = await createTestIdentity();
    extraUsers.push(other.userId);
    await saveSettings(ident.householdId, {
      model: "grok-shared",
      webSearch: true,
      reasoningEffort: "high",
      aiDailyCapEnabled: true,
      aiDailyCap: 10,
      developerTools: true,
    });
    await saveSettings(other.householdId, { developerTools: false });

    const mine = await getSettings(ident.householdId);
    const theirs = await getSettings(other.householdId);
    expect(mine.model).toBe("grok-shared");
    expect(theirs.model).toBe("grok-shared");
    expect(mine.webSearch).toBe(true);
    expect(theirs.webSearch).toBe(true);
    expect(mine.developerTools).toBe(true);
    expect(theirs.developerTools).toBe(false);
  });
});
