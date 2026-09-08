"use client";

import type { DayOfWeek, Meal, MealSlot, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import {
  pinnedSlotKeys,
  slotKey,
  summarizeSlotMask,
  toggleDay,
  toggleMealRow,
  toggleSlot,
} from "@/lib/slot-mask";
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
  collapsible = false,
  expanded = true,
  onExpandedChange,
}: {
  value: SlotMask;
  onChange: (next: SlotMask) => void;
  pinnedMeals?: Meal[];
  collapsible?: boolean;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}) {
  const locked = pinnedSlotKeys(pinnedMeals);
  const summary = summarizeSlotMask(value);
  const showGrid = !collapsible || expanded;

  return (
    <div className="surface overflow-x-auto p-4">
      {collapsible ? (
        <button
          type="button"
          className="slot-picker-toggle"
          aria-expanded={expanded}
          aria-controls="slot-picker-grid"
          onClick={() => onExpandedChange?.(!expanded)}
        >
          <span className="slot-picker-toggle-copy">
            <span className="page-eyebrow" style={{ marginBottom: 0 }}>
              Slots to fill
            </span>
            <span className="slot-picker-summary">{summary}</span>
          </span>
          <span className="slot-picker-chevron" aria-hidden="true" />
        </button>
      ) : (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="page-eyebrow" style={{ marginBottom: 4 }}>
              Slots to fill
            </p>
            <p className="m-0 text-sm text-herb">
              Check the meals to fill. Day and meal labels toggle a whole row
              or column. Pinned meals stay off.
            </p>
          </div>
        </div>
      )}
      {showGrid ? (
        <>
          {collapsible ? (
            <p className="mb-3 mt-3 text-sm text-herb">
              Check the meals to fill. Day and meal labels toggle a whole row
              or column. Pinned meals stay off.
            </p>
          ) : null}
          <table id="slot-picker-grid" className="w-full border-collapse">
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
                      onClick={() =>
                        onChange(toggleMealRow(value, slot, locked))
                      }
                    >
                      {SLOT_LABELS[slot]}
                    </button>
                  </th>
                  {DAYS.map((day) => {
                    const pinned = locked.has(slotKey(day, slot));
                    return (
                      <td key={day} className="p-2 text-center">
                        {pinned ? (
                          <input
                            className="h-5 w-5 accent-[var(--color-olive)]"
                            type="checkbox"
                            checked
                            disabled
                            aria-label={`${day} ${slot} locked`}
                            title="This slot is locked"
                          />
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
        </>
      ) : null}
    </div>
  );
}
