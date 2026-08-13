"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Meal } from "@/lib/types";

export function SwapButton({ meal }: { meal: Meal }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSwap() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: meal.planId, mealId: meal.id }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Couldn’t find a different meal, try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("The model didn’t respond");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() => {
          void onSwap();
        }}
      >
        {pending ? "Swapping…" : "Swap"}
      </button>
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MealCard({
  meal,
  onOpen,
}: {
  meal: Meal;
  onOpen?: (meal: Meal) => void;
}) {
  return (
    <article className="meal-card" data-slot={meal.slot}>
      <button
        type="button"
        className="meal-card-open"
        onClick={() => onOpen?.(meal)}
      >
        <h3>{meal.title}</h3>
        <p className="meal-meta">
          {meal.method} · {meal.cookMinutes} min
        </p>
        <p className="meal-why">{meal.whyItFits}</p>
      </button>
      <SwapButton meal={meal} />
    </article>
  );
}
