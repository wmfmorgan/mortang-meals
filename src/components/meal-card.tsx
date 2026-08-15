"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Meal } from "@/lib/types";
import { readUseIngredients } from "@/lib/use-ingredients";

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
        body: JSON.stringify({
          planId: meal.planId,
          mealId: meal.id,
          useIngredients: readUseIngredients(),
        }),
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
        className="icon-button"
        disabled={pending}
        aria-label={pending ? "Regenerating meal" : "Regenerate meal"}
        title={pending ? "Regenerating meal" : "Regenerate meal"}
        onClick={() => {
          void onSwap();
        }}
      >
        <RegenIcon spinning={pending} />
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

export function ImportIcon() {
  return (
    <span className="import-icon" title="Imported from a URL">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4.5H5.2A1.7 1.7 0 0 0 3.5 6.2v8.6A1.7 1.7 0 0 0 5.2 16.5h8.6a1.7 1.7 0 0 0 1.7-1.7V12" />
        <path d="M11 3.5h5.5V9" />
        <path d="M16.5 3.5 10 10" />
      </svg>
      <span className="sr-only">Imported from a URL</span>
    </span>
  );
}

export function MealBadges({ meal }: { meal: Meal }) {
  return (
    <>
      {meal.sourceUrl ? <ImportIcon /> : null}
      {meal.usedWebSearch ? <WebSearchStar /> : null}
    </>
  );
}

export function DeleteButton({ meal }: { meal: Meal }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    setPending(true);
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id }),
      });
      if (!res.ok) return;
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="icon-button icon-button-danger"
      aria-label="Delete meal"
      title="Delete meal"
      disabled={pending}
      onClick={() => {
        void onDelete();
      }}
    >
      <TrashIcon />
    </button>
  );
}

export function PinButton({
  meal,
  onChange,
}: {
  meal: Meal;
  onChange?: (pinned: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onToggle() {
    setPending(true);
    try {
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id, pinned: !meal.pinned }),
      });
      if (!res.ok) return;
      onChange?.(!meal.pinned);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className="pin-button"
      aria-pressed={meal.pinned}
      aria-label={meal.pinned ? "Unpin meal" : "Pin meal"}
      title={meal.pinned ? "Unpin meal" : "Pin meal"}
      disabled={pending}
      onClick={() => {
        void onToggle();
      }}
    >
      <PinIcon filled={meal.pinned} />
    </button>
  );
}

export function RegenIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={spinning ? "icon-spin" : undefined}
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.3 10.2A6.3 6.3 0 0 1 6 14.6L4.2 16.2V12H8.4" />
      <path d="M3.7 9.8A6.3 6.3 0 0 1 14 5.4l1.8-1.6V8H11.6" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.2 5.4h11.6M8 5.2V3.8h4V5.2M6.2 5.4l.6 11h6.4l.6-11" />
    </svg>
  );
}

export function RecipeBoxIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <rect x="3.2" y="7.4" width="13.6" height="9.2" rx="1.2" />
      <path d="M2.6 7.4h14.8L15.8 4.2H4.2z" />
      <path d="M7 10.4h6M7 13h4.2" />
    </svg>
  );
}

export function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="22"
      height="22"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M8.2 2.8h3.6l.6 4.2 2.4 2.2v1.4H5.2v-1.4l2.4-2.2.6-4.2zM10 10.6V17" />
    </svg>
  );
}

export function MealCard({
  meal,
  onOpen,
  onReplace,
  editable = false,
}: {
  meal: Meal;
  onOpen?: (meal: Meal) => void;
  onReplace?: (meal: Meal) => void;
  editable?: boolean;
}) {
  return (
    <article className="meal-card" data-slot={meal.slot} data-pinned={meal.pinned}>
      <div className="meal-card-top">
        <button
          type="button"
          className="meal-card-open"
          onClick={() => onOpen?.(meal)}
        >
          <h3>
            <MealBadges meal={meal} />
            <span className="meal-card-title">{meal.title}</span>
          </h3>
          <p className="meal-meta">
            {meal.method} · {meal.cookMinutes} min
          </p>
          <p className="meal-why">{meal.whyItFits}</p>
        </button>
        {editable ? (
          <div className="meal-card-tools">
            <PinButton meal={meal} />
            <DeleteButton meal={meal} />
          </div>
        ) : null}
      </div>
      <div className="meal-card-actions">
        {editable && onReplace ? (
          <button
            type="button"
            className="icon-button"
            aria-label="Choose a past recipe"
            title="Choose a past recipe"
            onClick={() => onReplace(meal)}
          >
            <RecipeBoxIcon />
          </button>
        ) : (
          <span />
        )}
        <SwapButton meal={meal} />
      </div>
    </article>
  );
}
