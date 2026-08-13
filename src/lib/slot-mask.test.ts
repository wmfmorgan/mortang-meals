import { describe, expect, it } from "vitest";
import {
  defaultSlotMask,
  emptySlotMask,
  hasAnySlot,
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

  it("toggles a meal row across the week", () => {
    const next = toggleMealRow(defaultSlotMask(), "lunch");
    expect(next.monday.lunch).toBe(true);
    expect(next.sunday.lunch).toBe(true);
    expect(next.monday.dinner).toBe(true);
  });
});
