"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Meal } from "@/lib/types";
import { RecipeFlyout, recipeEyebrow } from "./recipe-flyout";

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {drafts.map((meal) => (
          <article
            key={meal.id}
            className="meal-card p-4"
            data-slot={meal.slot}
          >
            <button
              type="button"
              className="meal-card-open w-full"
              onClick={() => setSelected(meal)}
            >
              <h3 className="mt-0 mb-0">
                <span className="meal-card-title">{meal.title}</span>
              </h3>
              <p className="meal-meta">
                {meal.slot} · {meal.cookMinutes} min · {meal.method}
              </p>
              <p className="meal-why">{meal.whyItFits}</p>
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
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
