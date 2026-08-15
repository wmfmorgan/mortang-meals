"use client";

import { useEffect, useState } from "react";
import type { DayOfWeek, LibraryMeal, MealSlot } from "@/lib/types";

const SLOT_WORDS: Record<MealSlot, string> = {
  breakfast: "breakfasts",
  lunch: "lunches",
  dinner: "dinners",
};

export function MealLibraryFlyout({
  day,
  slot,
  weekStart,
  onClose,
  onPlaced,
}: {
  day: DayOfWeek;
  slot: MealSlot;
  weekStart?: string;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const [meals, setMeals] = useState<LibraryMeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setMeals(null);
    setError(null);
    void fetch(`/api/library?slot=${slot}`)
      .then(async (res) => {
        const data = (await res.json()) as { meals?: LibraryMeal[]; message?: string };
        if (!res.ok) throw new Error(data.message ?? "Couldn’t load past meals.");
        if (!cancelled) setMeals(data.meals ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn’t load past meals.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slot]);

  async function onChoose(sourceMealId: string) {
    setPendingId(sourceMealId);
    setError(null);
    try {
      const res = await fetch("/api/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMealId,
          day,
          slot,
          ...(weekStart ? { weekStart } : {}),
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Couldn’t place that meal.");
      onPlaced();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t place that meal.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="recipe-flyout-root">
      <button
        type="button"
        className="recipe-backdrop"
        aria-label="Close past meals"
        onClick={onClose}
      />
      <aside
        className="recipe-flyout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="meal-library-title"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <p className="page-eyebrow" style={{ margin: 0 }}>
            Past {SLOT_WORDS[slot]}
          </p>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <h2
          id="meal-library-title"
          className="mt-0 mb-4 text-[1.7rem] font-medium tracking-[-0.035em]"
        >
          Choose a {slot}
        </h2>
        {error ? (
          <p role="alert" className="alert">
            {error}
          </p>
        ) : null}
        {meals === null ? (
          <p className="text-sm text-herb">Loading past meals…</p>
        ) : meals.length === 0 ? (
          <p className="text-sm text-herb">
            No past {SLOT_WORDS[slot]} yet. Generate a week first.
          </p>
        ) : (
          <ul className="space-y-2">
            {meals.map((meal) => (
              <li key={meal.id}>
                <button
                  type="button"
                  className="meal-library-item"
                  disabled={pendingId !== null}
                  onClick={() => {
                    void onChoose(meal.id);
                  }}
                >
                  <span className="meal-library-item-title">{meal.title}</span>
                  <span className="meal-library-item-meta">
                    {meal.method} · {meal.cookMinutes} min · {meal.weekStart}
                  </span>
                  {pendingId === meal.id ? (
                    <span className="meal-library-item-status">Adding…</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
