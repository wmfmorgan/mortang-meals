import { describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin";

describe("isAdminEmail", () => {
  it("matches the owner email case-insensitively", () => {
    expect(isAdminEmail("wfmorgan73@gmail.com")).toBe(true);
    expect(isAdminEmail("WFMorgan73@Gmail.com")).toBe(true);
  });

  it("rejects other emails", () => {
    expect(isAdminEmail("alex@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });
});
