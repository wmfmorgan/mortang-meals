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
        className="rounded border border-zinc-400 bg-white px-2 py-1 text-sm disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          void onSwap();
        }}
      >
        {pending ? "Swapping…" : "Swap"}
      </button>
      {error ? (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-sm"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MealCard({ meal }: { meal: Meal }) {
  return (
    <article className="flex h-full flex-col gap-2 rounded border border-zinc-300 bg-white p-2 text-sm">
      <a href={`/meals/${meal.id}`} className="space-y-1 text-blue-700">
        <h3 className="font-medium underline">{meal.title}</h3>
        <p className="text-zinc-600">{meal.slot}</p>
        <p className="text-zinc-600">
          {meal.method} · {meal.cookMinutes} min
        </p>
        <p className="text-zinc-700">{meal.whyItFits}</p>
      </a>
      <SwapButton meal={meal} />
    </article>
  );
}
