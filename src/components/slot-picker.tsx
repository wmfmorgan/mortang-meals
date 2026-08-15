"use client";

import type { DayOfWeek, Meal, MealSlot, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import {
  pinnedSlotKeys,
  slotKey,
  toggleDay,
  toggleMealRow,
  toggleSlot,
} from "@/lib/slot-mask";
import { PinIcon } from "./meal-card";

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function SlotPicker({
  value,
  onChange,
  pinnedMeals = [],
}: {
  value: SlotMask;
  onChange: (next: SlotMask) => void;
  pinnedMeals?: Meal[];
}) {
  const locked = pinnedSlotKeys(pinnedMeals);

  return (
    <div className="surface overflow-x-auto p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 4 }}>
            Slots to generate
          </p>
          <p className="m-0 text-sm text-herb">
            Check the meals you want. Day and meal labels toggle a whole row or
            column. Pinned meals stay off.
          </p>
        </div>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left font-mono text-[0.68rem] uppercase tracking-[0.12em] text-herb" />
            {DAYS.map((day) => (
              <th key={day} className="p-1 text-center">
                <button
                  type="button"
                  className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-herb"
                  onClick={() => onChange(toggleDay(value, day, locked))}
                >
                  {DAY_LABELS[day]}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot) => (
            <tr key={slot}>
              <th className="p-2 text-left">
                <button
                  type="button"
                  className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-herb"
                  onClick={() => onChange(toggleMealRow(value, slot, locked))}
                >
                  {SLOT_LABELS[slot]}
                </button>
              </th>
              {DAYS.map((day) => {
                const pinned = locked.has(slotKey(day, slot));
                return (
                  <td key={day} className="p-2 text-center">
                    {pinned ? (
                      <span
                        className="slot-pinned"
                        title="Pinned — Generate will skip this slot"
                      >
                        <PinIcon filled />
                        <span className="sr-only">
                          {day} {slot} pinned
                        </span>
                      </span>
                    ) : (
                      <input
                        className="h-5 w-5 accent-[var(--color-olive)]"
                        type="checkbox"
                        checked={Boolean(value[day]?.[slot])}
                        aria-label={`${day} ${slot}`}
                        onChange={(event) =>
                          onChange(
                            toggleSlot(
                              value,
                              day,
                              slot,
                              event.target.checked,
                              locked,
                            ),
                          )
                        }
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
