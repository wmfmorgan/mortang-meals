import { afterEach, describe, expect, it } from "vitest";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { ADMIN_EMAIL } from "@/lib/admin";
import { handlePutSettings } from "./http";
import { getSettings } from "./settings-repo";

describe("handlePutSettings owner check", () => {
  const cleanups: string[] = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const id = cleanups.pop();
      if (id) await deleteTestUser(id);
    }
  });

  it("allows the owner email to toggle web search", async () => {
    // Auth email is what the owner check uses (not the DB user's email).
    const ident = await createTestIdentity();
    cleanups.push(ident.userId);

    const result = await handlePutSettings(
      { webSearch: true },
      {
        auth: {
          userId: ident.userId,
          householdId: ident.householdId,
          email: ADMIN_EMAIL,
        },
      },
    );

    expect(result.status).toBe(200);
    expect((result.body as { settings: { webSearch: boolean } }).settings.webSearch).toBe(
      true,
    );
    expect((await getSettings(ident.householdId)).webSearch).toBe(true);
  });

  it("rejects when email is omitted from auth deps (regression)", async () => {
    const ident = await createTestIdentity();
    cleanups.push(ident.userId);

    const result = await handlePutSettings(
      { webSearch: true },
      {
        auth: {
          userId: ident.userId,
          householdId: ident.householdId,
        },
      },
    );

    // Without a session matching this test user, email stays null → 403.
    expect(result.status).toBe(403);
  });

  it("rejects a non-owner email", async () => {
    const ident = await createTestIdentity("not-owner@example.com");
    cleanups.push(ident.userId);

    const result = await handlePutSettings(
      { webSearch: true },
      {
        auth: {
          userId: ident.userId,
          householdId: ident.householdId,
          email: "not-owner@example.com",
        },
      },
    );

    expect(result.status).toBe(403);
    expect(result.body).toEqual({
      message: "Only the owner can change settings.",
    });
  });
});
