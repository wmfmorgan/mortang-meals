import { afterEach, describe, expect, it } from "vitest";
import type { Meal, SlotMask } from "./types";
import {
  defaultSlotMask,
  emptySlotMask,
  hasAnySlot,
  maskMinusPinned,
  readSlotPickerOpen,
  summarizeSlotMask,
  toggleDay,
  toggleMealRow,
  toggleSlot,
  writeSlotPickerOpen,
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

describe("summarizeSlotMask", () => {
  it("says no slots when nothing is on", () => {
    expect(summarizeSlotMask(emptySlotMask())).toBe("No slots");
  });

  it("summarizes the dinner-only default", () => {
    expect(summarizeSlotMask(defaultSlotMask())).toBe("7 dinners");
  });

  it("summarizes a full week", () => {
    const mask = emptySlotMask();
    for (const day of Object.keys(mask) as (keyof SlotMask)[]) {
      mask[day].breakfast = true;
      mask[day].lunch = true;
      mask[day].dinner = true;
    }
    expect(summarizeSlotMask(mask)).toBe("All 21 slots");
  });

  it("names a consecutive weekday dinner run", () => {
    const mask = emptySlotMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    mask.wednesday.dinner = true;
    mask.thursday.dinner = true;
    mask.friday.dinner = true;
    expect(summarizeSlotMask(mask)).toBe("Mon–Fri dinner");
  });

  it("joins mixed meals in first-day order", () => {
    const mask = emptySlotMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    mask.wednesday.dinner = true;
    mask.thursday.dinner = true;
    mask.friday.dinner = true;
    mask.saturday.lunch = true;
    expect(summarizeSlotMask(mask)).toBe("Mon–Fri dinner, Sat lunch");
  });

  it("lists a few scattered days", () => {
    const mask = emptySlotMask();
    mask.monday.dinner = true;
    mask.wednesday.dinner = true;
    mask.friday.dinner = true;
    expect(summarizeSlotMask(mask)).toBe("Mon, Wed, Fri dinner");
  });
});

describe("slot picker open session flag", () => {
  const memory = new Map<string, string>();

  afterEach(() => {
    memory.clear();
    // @ts-expect-error test stub
    delete globalThis.sessionStorage;
  });

  function stubSessionStorage() {
    globalThis.sessionStorage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
      key: () => null,
      length: 0,
    };
  }

  it("returns null when the key is missing", () => {
    stubSessionStorage();
    expect(readSlotPickerOpen()).toBeNull();
  });

  it("round-trips true and false", () => {
    stubSessionStorage();
    writeSlotPickerOpen(true);
    expect(readSlotPickerOpen()).toBe(true);
    writeSlotPickerOpen(false);
    expect(readSlotPickerOpen()).toBe(false);
  });

  it("returns null for garbage", () => {
    stubSessionStorage();
    sessionStorage.setItem("mortang.slotPickerOpen", "yes");
    expect(readSlotPickerOpen()).toBeNull();
  });
});
