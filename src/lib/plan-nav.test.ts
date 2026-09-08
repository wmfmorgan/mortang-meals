import { describe, expect, it } from "vitest";
import { groupPlansForMenu } from "./plan-nav";

function plan(
  id: string,
  weekStart: string,
  extra: { name?: string; favorited?: boolean; isCurrent?: boolean } = {},
) {
  return {
    id,
    weekStart,
    isCurrent: extra.isCurrent ?? false,
    name: extra.name ?? "",
    favorited: extra.favorited ?? false,
  };
}

describe("groupPlansForMenu", () => {
  it("pins favorites and groups the rest by month", () => {
    const grouped = groupPlansForMenu([
      plan("sep", "2026-08-31"),
      plan("aug", "2026-08-10", { name: "Beach", favorited: true }),
      plan("jul", "2026-07-06"),
      plan("aug2", "2026-08-17"),
    ]);
    expect(grouped.favorites.map((item) => item.id)).toEqual(["aug"]);
    expect(grouped.months.map((month) => month.label)).toEqual([
      "August 2026",
      "July 2026",
    ]);
    expect(grouped.months[0]?.plans.map((item) => item.id)).toEqual([
      "sep",
      "aug2",
    ]);
  });
});
