import { describe, expect, it } from "vitest";
import {
  mondayOf,
  planDisplayName,
  shiftMonday,
  weekMonthLabel,
  weekRangeLabel,
} from "./week";

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

  it("uses this week's Monday for 2026-09-06 (Sunday)", () => {
    expect(mondayOf(new Date(2026, 8, 6))).toBe("2026-08-31");
  });
});

describe("weekRangeLabel", () => {
  it("names a plan by Monday through Sunday", () => {
    expect(weekRangeLabel("2026-08-24")).toBe("Aug 24–30, 2026");
    expect(weekRangeLabel("2026-08-31")).toBe("Aug 31–Sep 6, 2026");
  });
});

describe("planDisplayName", () => {
  it("uses a custom name when set", () => {
    expect(
      planDisplayName({ name: " Thanksgiving week ", weekStart: "2026-08-31" }),
    ).toBe("Thanksgiving week");
  });

  it("falls back to the week range", () => {
    expect(planDisplayName({ name: "", weekStart: "2026-08-31" })).toBe(
      "Aug 31–Sep 6, 2026",
    );
  });
});

describe("weekMonthLabel", () => {
  it("names the month of that Monday", () => {
    expect(weekMonthLabel("2026-08-31")).toBe("August 2026");
  });
});

describe("shiftMonday", () => {
  it("moves a Monday forward and back by weeks", () => {
    expect(shiftMonday("2026-01-05", 1)).toBe("2026-01-12");
    expect(shiftMonday("2026-01-05", -1)).toBe("2025-12-29");
  });
});
