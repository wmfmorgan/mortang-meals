import { describe, expect, it } from "vitest";
import { mondayOf, shiftMonday } from "./week";

// 2026-01-05 Monday, 2026-01-07 Wednesday, 2026-01-11 Sunday (local dates)
describe("mondayOf", () => {
  it("returns the Monday of a mid-week date", () => {
    expect(mondayOf(new Date(2026, 0, 7))).toBe("2026-01-05");
  });

  it("returns the same day when the date is Monday", () => {
    expect(mondayOf(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("walks back from Sunday to the previous Monday", () => {
    expect(mondayOf(new Date(2026, 0, 11))).toBe("2026-01-05");
  });
});

describe("shiftMonday", () => {
  it("moves a Monday forward and back by weeks", () => {
    expect(shiftMonday("2026-01-05", 1)).toBe("2026-01-12");
    expect(shiftMonday("2026-01-05", -1)).toBe("2025-12-29");
  });
});
