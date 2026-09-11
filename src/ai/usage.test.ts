import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { aiUsage } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { AI_DAILY_CAP, consumeAiQuota } from "./usage";

const grok = {
  mode: "grok" as const,
  baseUrl: "https://api.x.ai/v1",
  model: "grok-4.6",
  customApiKey: null,
  developerTools: false,
  webSearch: false,
};

describe("consumeAiQuota", () => {
  afterEach(resetDbForTests);

  it("allows AI_DAILY_CAP calls then 429s", async () => {
    const ident = await createTestIdentity();
    let last: Awaited<ReturnType<typeof consumeAiQuota>> = { ok: true };
    for (let i = 0; i < AI_DAILY_CAP; i++) {
      last = await consumeAiQuota({ userId: ident.userId, settings: grok });
      expect(last.ok).toBe(true);
    }
    last = await consumeAiQuota({ userId: ident.userId, settings: grok });
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.result.status).toBe(429);
    await deleteTestUser(ident.userId);
  });

  it("does not cap custom-provider keys", async () => {
    const ident = await createTestIdentity();
    const settings = { ...grok, mode: "custom" as const, customApiKey: "sk-test" };
    for (let i = 0; i < AI_DAILY_CAP + 2; i++) {
      const result = await consumeAiQuota({ userId: ident.userId, settings });
      expect(result.ok).toBe(true);
    }
    await deleteTestUser(ident.userId);
  });

  it("does not increment generate_count on 429", async () => {
    const ident = await createTestIdentity();
    for (let i = 0; i < AI_DAILY_CAP; i++) {
      await consumeAiQuota({ userId: ident.userId, settings: grok });
    }
    const blocked = await consumeAiQuota({
      userId: ident.userId,
      settings: grok,
    });
    expect(blocked.ok).toBe(false);
    const day = new Date().toISOString().slice(0, 10);
    const [row] = await getDb()
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, ident.userId), eq(aiUsage.day, day)));
    expect(row?.generateCount).toBe(AI_DAILY_CAP);
    await deleteTestUser(ident.userId);
  });
});
