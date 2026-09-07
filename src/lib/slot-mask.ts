import type { DayOfWeek, Meal, SlotMask, WeekSlot } from "./types";
import { DAYS, SLOTS } from "./types";

export const SLOT_MASK_KEY = "mortang.slotMask";
export const SLOT_PICKER_OPEN_KEY = "mortang.slotPickerOpen";

const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const SLOT_PLURAL: Record<WeekSlot, string> = {
  breakfast: "breakfasts",
  lunch: "lunches",
  dinner: "dinners",
};

export function emptySlotMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      Object.fromEntries(SLOTS.map((slot) => [slot, false])),
    ]),
  ) as SlotMask;
}

export function defaultSlotMask(): SlotMask {
  const mask = emptySlotMask();
  for (const day of DAYS) {
    mask[day].dinner = true;
  }
  return mask;
}

export function hasAnySlot(mask: SlotMask): boolean {
  return DAYS.some((day) => SLOTS.some((slot) => Boolean(mask[day]?.[slot])));
}

export function visibleWeekSlots(
  mask: SlotMask,
  meals: Array<Pick<Meal, "day" | "slot">>,
): WeekSlot[] {
  return SLOTS.filter(
    (slot) =>
      DAYS.some((day) => Boolean(mask[day]?.[slot])) ||
      meals.some((meal) => meal.slot === slot),
  );
}

export function remainingFillCount(
  mask: SlotMask,
  meals: Array<Pick<Meal, "day" | "slot">>,
): number {
  let count = 0;
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      if (!mask[day]?.[slot]) continue;
      if (meals.some((meal) => meal.day === day && meal.slot === slot)) continue;
      count += 1;
    }
  }
  return count;
}

export function slotKey(day: DayOfWeek, slot: WeekSlot): string {
  return `${day}:${slot}`;
}

export function pinnedSlotKeys(meals: Meal[]): Set<string> {
  return new Set(
    meals.filter((meal) => meal.pinned).map((meal) => slotKey(meal.day, meal.slot)),
  );
}

export function maskMinusPinned(mask: SlotMask, meals: Meal[]): SlotMask {
  const next = structuredClone(mask);
  for (const meal of meals) {
    if (meal.pinned && next[meal.day]) {
      next[meal.day][meal.slot] = false;
    }
  }
  return next;
}

export function toggleSlot(
  mask: SlotMask,
  day: DayOfWeek,
  slot: WeekSlot,
  enabled: boolean,
  locked: Set<string> = new Set(),
): SlotMask {
  if (locked.has(slotKey(day, slot))) {
    return {
      ...mask,
      [day]: { ...mask[day], [slot]: false },
    };
  }
  return {
    ...mask,
    [day]: { ...mask[day], [slot]: enabled },
  };
}

export function toggleDay(
  mask: SlotMask,
  day: DayOfWeek,
  locked: Set<string> = new Set(),
): SlotMask {
  const free = SLOTS.filter((slot) => !locked.has(slotKey(day, slot)));
  const enable = free.some((slot) => !mask[day][slot]);
  return {
    ...mask,
    [day]: Object.fromEntries(
      SLOTS.map((slot) => [
        slot,
        locked.has(slotKey(day, slot)) ? false : enable,
      ]),
    ) as Record<WeekSlot, boolean>,
  };
}

export function toggleMealRow(
  mask: SlotMask,
  slot: WeekSlot,
  locked: Set<string> = new Set(),
): SlotMask {
  const free = DAYS.filter((day) => !locked.has(slotKey(day, slot)));
  const enable = free.some((day) => !mask[day][slot]);
  const next = { ...mask };
  for (const day of DAYS) {
    next[day] = {
      ...next[day],
      [slot]: locked.has(slotKey(day, slot)) ? false : enable,
    };
  }
  return next;
}

export function readSessionMask(): SlotMask | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SLOT_MASK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SlotMask;
  } catch {
    return null;
  }
}

export function writeSessionMask(mask: SlotMask) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SLOT_MASK_KEY, JSON.stringify(mask));
}

function daysOnForSlot(mask: SlotMask, slot: WeekSlot): DayOfWeek[] {
  return DAYS.filter((day) => Boolean(mask[day]?.[slot]));
}

function isConsecutive(days: DayOfWeek[]): boolean {
  if (days.length <= 1) return false;
  const indices = days.map((day) => DAYS.indexOf(day));
  return indices.every(
    (index, offset) => offset === 0 || index === indices[offset - 1] + 1,
  );
}

function summarizeOneSlot(slot: WeekSlot, days: DayOfWeek[]): string {
  if (days.length === 7) return `7 ${SLOT_PLURAL[slot]}`;
  if (isConsecutive(days)) {
    return `${DAY_SHORT[days[0]]}–${DAY_SHORT[days[days.length - 1]]} ${slot}`;
  }
  if (days.length === 1) return `${DAY_SHORT[days[0]]} ${slot}`;
  if (days.length <= 3) {
    return `${days.map((day) => DAY_SHORT[day]).join(", ")} ${slot}`;
  }
  return `${days.length} ${SLOT_PLURAL[slot]}`;
}

export function summarizeSlotMask(mask: SlotMask): string {
  let enabled = 0;
  const parts: { firstDayIndex: number; slotIndex: number; text: string }[] =
    [];
  for (const [slotIndex, slot] of SLOTS.entries()) {
    const days = daysOnForSlot(mask, slot);
    enabled += days.length;
    if (days.length === 0) continue;
    parts.push({
      firstDayIndex: DAYS.indexOf(days[0]),
      slotIndex,
      text: summarizeOneSlot(slot, days),
    });
  }
  if (enabled === 0) return "No slots";
  if (enabled === 21) return "All 21 slots";
  parts.sort((a, b) => {
    if (a.firstDayIndex !== b.firstDayIndex) {
      return a.firstDayIndex - b.firstDayIndex;
    }
    return a.slotIndex - b.slotIndex;
  });
  return parts.map((part) => part.text).join(", ");
}

export function readSlotPickerOpen(): boolean | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SLOT_PICKER_OPEN_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

export function writeSlotPickerOpen(open: boolean) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SLOT_PICKER_OPEN_KEY, open ? "1" : "0");
}
