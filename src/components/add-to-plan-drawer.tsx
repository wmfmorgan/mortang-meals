"use client";

import { useEffect, useState } from "react";
import type { DayOfWeek, Meal, WeekSlot } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";

const SLOT_LABELS: Record<WeekSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

function defaultWeekSlot(slot: Meal["slot"]): WeekSlot {
  if (slot === "breakfast" || slot === "lunch" || slot === "dinner") return slot;
  return "dinner";
}

function weekdayName(day: DayOfWeek): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export function AddToPlanDrawer({
  meal,
  weekStart,
  onPlaced,
  onClose,
}: {
  meal: Meal;
  weekStart: string;
  onPlaced: (day: DayOfWeek, slot: WeekSlot) => void;
  onClose: () => void;
}) {
  const [day, setDay] = useState<DayOfWeek>("monday");
  const [slot, setSlot] = useState<WeekSlot>(() => defaultWeekSlot(meal.slot));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSlot(defaultWeekSlot(meal.slot));
  }, [meal.slot]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function onConfirm() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMealId: meal.id,
          day,
          slot,
          weekStart,
        }),
      });
      if (!res.ok) {
        let message = "Couldn’t place that meal.";
        try {
          const data = (await res.json()) as { message?: string };
          if (data.message) message = data.message;
        } catch {
          // keep default
        }
        throw new Error(message);
      }
      onPlaced(day, slot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t place that meal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="library-modal-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        className="library-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-plan-title"
      >
        <h2 id="add-to-plan-title" className="library-drawer-title">
          Add to Meal Plan
        </h2>
        <div className="library-drawer-recipe">
          <p className="page-eyebrow">Selected Recipe</p>
          <p className="library-drawer-recipe-name">{meal.title}</p>
        </div>
        <div>
          <p className="page-eyebrow">Choose Day</p>
          <div className="library-day-pills">
            {DAYS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={weekdayName(item)}
                aria-pressed={day === item}
                onClick={() => setDay(item)}
              >
                {weekdayName(item).slice(0, 1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="page-eyebrow">Choose Meal Slot</p>
          <div
            className="library-slot-radios"
            role="radiogroup"
            aria-label="Choose Meal Slot"
          >
            {SLOTS.map((item) => (
              <label key={item} className="library-slot-radio">
                <input
                  type="radio"
                  name="meal-slot"
                  value={item}
                  checked={slot === item}
                  onChange={() => setSlot(item)}
                />
                {SLOT_LABELS[item]}
              </label>
            ))}
          </div>
        </div>
        {error ? (
          <p role="alert" className="alert">
            {error}
          </p>
        ) : null}
        <div className="library-drawer-actions">
          <button
            type="button"
            className="btn btn-primary library-pill"
            disabled={pending}
            onClick={() => {
              void onConfirm();
            }}
          >
            Confirm
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </aside>
    </>
  );
}
