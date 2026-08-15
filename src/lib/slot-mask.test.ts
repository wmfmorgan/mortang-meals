import { describe, expect, it } from "vitest";
import type { Meal } from "./types";
import {
  defaultSlotMask,
  emptySlotMask,
  hasAnySlot,
  maskMinusPinned,
  toggleDay,
  toggleMealRow,
  toggleSlot,
} from "./slot-mask";

describe("slot mask helpers", () => {
  it("defaults to dinners only", () => {
    const mask = defaultSlotMask();
    expect(mask.monday.dinner).toBe(true);
    expect(mask.monday.breakfast).toBe(false);
    expect(hasAnySlot(mask)).toBe(true);
    expect(hasAnySlot(emptySlotMask())).toBe(false);
  });

  it("toggles one cell", () => {
    const next = toggleSlot(defaultSlotMask(), "monday", "breakfast", true);
    expect(next.monday.breakfast).toBe(true);
    expect(next.monday.dinner).toBe(true);
  });

  it("toggles a whole day on when any slot is off", () => {
    const next = toggleDay(defaultSlotMask(), "monday");
    expect(next.monday).toEqual({
      breakfast: true,
      lunch: true,
      dinner: true,
    });
  });

  it("does not enable locked slots when toggling a day or row", () => {
    const locked = new Set(["monday:dinner"]);
    const next = toggleDay(emptySlotMask(), "monday", locked);
    expect(next.monday).toEqual({
      breakfast: true,
      lunch: true,
      dinner: false,
    });
    const row = toggleMealRow(emptySlotMask(), "dinner", locked);
    expect(row.monday.dinner).toBe(false);
    expect(row.tuesday.dinner).toBe(true);
  });

  it("toggles a meal row across the week", () => {
    const next = toggleMealRow(defaultSlotMask(), "lunch");
    expect(next.monday.lunch).toBe(true);
    expect(next.sunday.lunch).toBe(true);
    expect(next.monday.dinner).toBe(true);
  });

  it("turns off pinned squares in the generate mask", () => {
    const mask = defaultSlotMask();
    const pinned = {
      day: "monday",
      slot: "dinner",
      pinned: true,
    } as Meal;
    const next = maskMinusPinned(mask, [pinned]);
    expect(next.monday.dinner).toBe(false);
    expect(next.tuesday.dinner).toBe(true);
  });
});
