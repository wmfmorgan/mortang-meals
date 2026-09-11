import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { households } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { listTraces, recordTrace, redactSecrets } from "./traces";

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

function sampleTrace(householdId: string, requestText: string) {
  return {
    householdId,
    kind: "generate" as const,
    mode: "grok" as const,
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4.6",
    requestText,
    responseText: `res ${requestText}`,
    validation: "ok" as const,
  };
}

describe("AI traces", () => {
  it("redacts API keys and Authorization headers", () => {
    expect(redactSecrets("Authorization: Bearer sk-test\nXAI_API_KEY=abc")).not.toContain(
      "sk-test",
    );
    expect(redactSecrets("XAI_API_KEY=abc")).not.toContain("abc");
  });

  it("keeps only the last 25 traces", async () => {
    for (let i = 0; i < 26; i++) {
      await recordTrace(sampleTrace(ident.householdId, `req ${i}`));
    }
    const rows = await listTraces(ident.householdId);
    expect(rows).toHaveLength(25);
    expect(rows[0].requestText).toBe("req 25");
  });

  it("recording 26 traces in A leaves B empty and A at 25", async () => {
    const other = await createTestIdentity();
    extraUsers.push(other.userId);
    for (let i = 0; i < 26; i++) {
      await recordTrace(sampleTrace(ident.householdId, `a ${i}`));
    }
    expect(await listTraces(other.householdId)).toEqual([]);
    expect(await listTraces(ident.householdId)).toHaveLength(25);
  });
});
