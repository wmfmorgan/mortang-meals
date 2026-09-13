import { describe, expect, it } from "vitest";
import { canViewDeveloper } from "./visibility";

describe("canViewDeveloper", () => {
  it("requires developer tools and the admin email", () => {
    expect(canViewDeveloper(false, "wfmorgan73@gmail.com")).toBe(false);
    expect(canViewDeveloper(true, "alex@example.com")).toBe(false);
    expect(canViewDeveloper(true, "wfmorgan73@gmail.com")).toBe(true);
  });
});
