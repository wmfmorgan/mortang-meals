import { describe, expect, it } from "vitest";
import { canViewDeveloper } from "./visibility";

describe("canViewDeveloper", () => {
  it("is true only when the settings toggle is on", () => {
    expect(canViewDeveloper(false)).toBe(false);
    expect(canViewDeveloper(true)).toBe(true);
  });
});
