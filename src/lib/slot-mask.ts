import type { DayOfWeek, MealSlot, SlotMask } from "./types";
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

export function toggleSlot(
  mask: SlotMask,
  day: DayOfWeek,
  slot: MealSlot,
  enabled: boolean,
): SlotMask {
  return {
    ...mask,
    [day]: { ...mask[day], [slot]: enabled },
  };
}

export function toggleDay(mask: SlotMask, day: DayOfWeek): SlotMask {
  const enable = SLOTS.some((slot) => !mask[day][slot]);
  return {
    ...mask,
    [day]: Object.fromEntries(SLOTS.map((slot) => [slot, enable])) as Record<
      MealSlot,
      boolean
    >,
  };
}

export function toggleMealRow(mask: SlotMask, slot: MealSlot): SlotMask {
  const enable = DAYS.some((day) => !mask[day][slot]);
  const next = { ...mask };
  for (const day of DAYS) {
    next[day] = { ...next[day], [slot]: enable };
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
