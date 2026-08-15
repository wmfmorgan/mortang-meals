import type { DayOfWeek, Meal, MealSlot, SlotMask } from "./types";
import { DAYS, SLOTS } from "./types";

export const SLOT_MASK_KEY = "mortang.slotMask";

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

export function slotKey(day: DayOfWeek, slot: MealSlot): string {
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
  slot: MealSlot,
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
    ) as Record<MealSlot, boolean>,
  };
}

export function toggleMealRow(
  mask: SlotMask,
  slot: MealSlot,
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
