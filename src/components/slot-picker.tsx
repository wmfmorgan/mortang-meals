"use client";

import type { DayOfWeek, MealSlot, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { toggleDay, toggleMealRow, toggleSlot } from "@/lib/slot-mask";

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
}: {
  value: SlotMask;
  onChange: (next: SlotMask) => void;
}) {
  return (
    <div className="surface overflow-x-auto p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="page-eyebrow" style={{ marginBottom: 4 }}>
            Slots to generate
          </p>
          <p className="m-0 text-sm text-herb">
            Check the meals you want. Day and meal labels toggle a whole row or
            column.
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
                  onClick={() => onChange(toggleDay(value, day))}
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
                  onClick={() => onChange(toggleMealRow(value, slot))}
                >
                  {SLOT_LABELS[slot]}
                </button>
              </th>
              {DAYS.map((day) => (
                <td key={day} className="p-2 text-center">
                  <input
                    className="h-5 w-5 accent-[var(--color-olive)]"
                    type="checkbox"
                    checked={Boolean(value[day]?.[slot])}
                    aria-label={`${day} ${slot}`}
                    onChange={(event) =>
                      onChange(toggleSlot(value, day, slot, event.target.checked))
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
