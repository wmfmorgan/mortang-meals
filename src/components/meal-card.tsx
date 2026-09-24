"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExtraKind, Meal, MealExtra } from "@/lib/types";
import { readUseIngredients } from "@/lib/use-ingredients";
import { MealExtras } from "./meal-extras";
import { MealImage } from "./meal-image";

export function SwapButton({ meal }: { meal: Meal }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onSwap() {
    const note = prompt.trim();
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
          ...(note ? { prompt: note } : {}),
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Couldn’t find a different meal, try again.");
        return;
      }
      setOpen(false);
      setPrompt("");
      router.refresh();
    } catch {
      setError("The model didn’t respond");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="swap-button" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        disabled={pending}
        aria-expanded={open}
        aria-label={pending ? "Regenerating meal" : "Regenerate meal"}
        title={pending ? "Regenerating meal" : "Regenerate meal"}
        onClick={() => setOpen((current) => !current)}
      >
        <RegenIcon spinning={pending} />
      </button>
      {open ? (
        <form
          className="swap-popover"
          onSubmit={(event) => {
            event.preventDefault();
            void onSwap();
          }}
        >
          <label className="field" style={{ margin: 0, flex: 1 }}>
            <span className="sr-only">How should this meal change?</span>
            <input
              className="input"
              value={prompt}
              maxLength={200}
              disabled={pending}
              placeholder="e.g. made on the grill"
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending}
          >
            {pending ? "Regenerating…" : "Regenerate"}
          </button>
        </form>
      ) : null}
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

export function DeleteButton({
  meal,
  icon = "close",
  confirmMessage,
  onDeleted,
}: {
  meal: Meal;
  icon?: "close" | "trash";
  /** When set, asks before deleting (catalog cards). */
  confirmMessage?: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onDelete() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id }),
      });
      if (!res.ok) return;
      onDeleted?.();
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
      onClick={(event) => {
        event.stopPropagation();
        void onDelete();
      }}
    >
      {icon === "trash" ? <TrashIcon /> : <CloseIcon />}
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

export function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M5 5 15 15" />
      <path d="M15 5 5 15" />
    </svg>
  );
}

/** Lucide `salad` — https://lucide.dev/icons/salad */
export function SideIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 21h10" />
      <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" />
      <path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1" />
      <path d="m13 12 4-4" />
      <path d="M10.9 7.25A3.99 3.99 0 0 0 4 10c0 .73.2 1.41.54 2" />
    </svg>
  );
}

/** Lucide `ice-cream-cone` — https://lucide.dev/icons/ice-cream-cone */
export function DessertIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
      <path d="M17 7A5 5 0 0 0 7 7" />
      <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
    </svg>
  );
}

/** Lucide `paper-bag` — https://lucide.dev/icons/paper-bag */
export function LeftoversIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.364 3.848C4 6 3 9.652 3 12.652V19a2 2 0 002 2h14a2 2 0 002-2v-5c0-2.334-1.816-4.668-2.622-7.002" />
      <path d="M7 3h11.379a2 2 0 011.789 1.106l.723 1.447A1 1 0 0119.997 7h-8.525a2 2 0 01-1.789-1.106L8.79 4.105a2 2 0 10-3.579 1.789l2.261 4.522A5 5 0 018 12.652V21" />
    </svg>
  );
}

export function MealCard({
  meal,
  onOpen,
  onOpenExtra,
  onChooseExtra,
  onReplace,
  onLeftover,
  editable = false,
  canSwap = false,
  compact = false,
}: {
  meal: Meal;
  onOpen?: (meal: Meal) => void;
  onOpenExtra?: (extra: MealExtra) => void;
  onChooseExtra?: (kind: ExtraKind) => void;
  onReplace?: (meal: Meal) => void;
  onLeftover?: (meal: Meal) => void;
  editable?: boolean;
  canSwap?: boolean;
  /** Week grid: title + extras + leftovers + delete only. */
  compact?: boolean;
}) {
  return (
    <article
      className={compact ? "meal-card meal-card-compact" : "meal-card"}
      data-slot={meal.slot}
      data-pinned={meal.pinned}
    >
      {compact ? <MealImage imageUrl={meal.imageUrl} compact /> : null}
      <div className="meal-card-top">
        <button
          type="button"
          className="meal-card-open"
          onClick={() => onOpen?.(meal)}
        >
          <h3>
            {compact ? null : <MealBadges meal={meal} />}
            <span className="meal-card-title">{meal.title}</span>
          </h3>
          {compact ? null : (
            <>
              <p className="meal-meta">
                {meal.takeout
                  ? "Takeout"
                  : meal.leftover
                    ? `Leftovers · ${meal.cookMinutes} min`
                    : `${meal.method} · ${meal.cookMinutes} min`}
              </p>
              {meal.takeout ? null : (
                <p className="meal-why">{meal.whyItFits}</p>
              )}
            </>
          )}
        </button>
        {editable && !compact ? (
          <div className="meal-card-tools">
            <DeleteButton meal={meal} />
          </div>
        ) : null}
      </div>
      {meal.takeout ? null : (
        <MealExtras
          meal={meal}
          editable={editable}
          onOpenExtra={onOpenExtra}
        />
      )}
      {compact ? (
        editable ? (
          <div className="meal-card-actions meal-card-action-icons">
            {!meal.takeout && meal.slot !== "breakfast" && onChooseExtra ? (
              <>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={
                    meal.extras?.side ? "Replace side" : "Choose a side"
                  }
                  title={meal.extras?.side ? "Replace side" : "Choose a side"}
                  onClick={() => onChooseExtra("side")}
                >
                  <SideIcon />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={
                    meal.extras?.dessert
                      ? "Replace dessert"
                      : "Choose a dessert"
                  }
                  title={
                    meal.extras?.dessert
                      ? "Replace dessert"
                      : "Choose a dessert"
                  }
                  onClick={() => onChooseExtra("dessert")}
                >
                  <DessertIcon />
                </button>
              </>
            ) : null}
            {!meal.takeout && onLeftover && !meal.leftover ? (
              <button
                type="button"
                className="icon-button"
                aria-label="Place leftovers on another meal"
                title="Place leftovers on another meal"
                onClick={() => onLeftover(meal)}
              >
                <LeftoversIcon />
              </button>
            ) : null}
            <DeleteButton meal={meal} icon="trash" />
          </div>
        ) : null
      ) : (
        <div className="meal-card-actions meal-card-action-icons">
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
          ) : null}
          {editable && !meal.takeout && meal.slot !== "breakfast" && onChooseExtra ? (
            <>
              <button
                type="button"
                className="icon-button"
                aria-label={
                  meal.extras?.side ? "Replace side" : "Choose a side"
                }
                title={meal.extras?.side ? "Replace side" : "Choose a side"}
                onClick={() => onChooseExtra("side")}
              >
                <SideIcon />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={
                  meal.extras?.dessert
                    ? "Replace dessert"
                    : "Choose a dessert"
                }
                title={
                  meal.extras?.dessert
                    ? "Replace dessert"
                    : "Choose a dessert"
                }
                onClick={() => onChooseExtra("dessert")}
              >
                <DessertIcon />
              </button>
            </>
          ) : null}
          {editable && onLeftover && !meal.leftover ? (
            <button
              type="button"
              className="icon-button"
              aria-label="Place leftovers on another meal"
              title="Place leftovers on another meal"
              onClick={() => onLeftover(meal)}
            >
              <LeftoversIcon />
            </button>
          ) : null}
          {canSwap ? <SwapButton meal={meal} /> : null}
        </div>
      )}
    </article>
  );
}
