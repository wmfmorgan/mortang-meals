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

export function WebSearchStar() {
  return (
    <span className="web-search-star" title="Found with web search">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        width="14"
        height="14"
        fill="currentColor"
      >
        <path d="M10 1.6 12.2 7l5.8.4-4.4 3.7 1.4 5.6L10 13.8 4.9 16.7 6.4 11.1 2 7.4 7.8 7z" />
      </svg>
      <span className="sr-only">Found with web search</span>
    </span>
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
        <h3>
          {meal.usedWebSearch ? <WebSearchStar /> : null}
          {meal.title}
        </h3>
        <p className="meal-meta">
          {meal.method} · {meal.cookMinutes} min
        </p>
        <p className="meal-why">{meal.whyItFits}</p>
      </button>
      <SwapButton meal={meal} />
    </article>
  );
}
