import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("allows relative in-app paths", () => {
    expect(safeNextPath("/join?code=ABCD")).toBe("/join?code=ABCD");
    expect(safeNextPath("/household")).toBe("/household");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("/\\evil")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath("")).toBeNull();
  });
});

