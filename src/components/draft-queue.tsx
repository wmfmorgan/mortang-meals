"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Meal } from "@/lib/types";
import { MealImage } from "./meal-image";
import { RecipeFlyout, recipeEyebrow } from "./recipe-flyout";

function slotLabel(slot: Meal["slot"]): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export function DraftQueue({
  drafts,
  servings,
}: {
  drafts: Meal[];
  servings: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Meal | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (drafts.length === 0) return null;

  async function post(path: string, mealId: string) {
    setPendingId(mealId);
    try {
      await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId }),
      });
      setSelected(null);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="page-eyebrow" style={{ margin: 0 }}>
            Drafts
          </p>
          <h2 className="mt-1 mb-0 text-xl font-medium tracking-[-0.03em]">
            Review before they join the library
          </h2>
        </div>
      </div>
      <div className="library-grid">
        {drafts.map((meal) => (
          <article key={meal.id} className="library-card" data-slot={meal.slot}>
            <button
              type="button"
              className="library-card-open"
              onClick={() => setSelected(meal)}
              aria-label={meal.title}
            />
            <div className="library-card-photo">
              <MealImage imageUrl={meal.imageUrl} />
              <div className="library-card-badges">
                <span className="library-card-badge library-pill">
                  {meal.cookMinutes} min
                </span>
                <span className="library-card-badge library-card-badge-slot library-pill">
                  {slotLabel(meal.slot)}
                </span>
              </div>
            </div>
            <div className="library-card-body">
              <h3 className="library-card-title">{meal.title}</h3>
              <p className="library-card-why">{meal.whyItFits}</p>
              <p className="library-card-servings">Servings: {meal.servings}</p>
            </div>
            <div className="library-card-actions">
              <button
                type="button"
                className="btn btn-primary library-pill"
                disabled={pendingId !== null}
                onClick={() => void post("/api/library/approve", meal.id)}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pendingId !== null}
                onClick={() => void post("/api/library/reject", meal.id)}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
      {selected ? (
        <RecipeFlyout
          meal={selected}
          servings={servings}
          onClose={() => setSelected(null)}
          canSwap={false}
          eyebrow={recipeEyebrow(selected)}
        />
      ) : null}
    </section>
  );
}
