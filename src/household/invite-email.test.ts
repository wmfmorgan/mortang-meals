import { describe, expect, it } from "vitest";
import { normalizeInviteEmail } from "./invite-email";

describe("normalizeInviteEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeInviteEmail("  Alex@Example.COM ")).toBe("alex@example.com");
  });

  it("rejects empty or invalid", () => {
    expect(() => normalizeInviteEmail("")).toThrow(/valid email/i);
    expect(() => normalizeInviteEmail("not-an-email")).toThrow(/valid email/i);
  });
});
