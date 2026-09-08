"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Meal } from "@/lib/types";
import { CloseIcon, MealBadges, SwapButton } from "./meal-card";
import { StarRating } from "./star-rating";

const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
} as const;

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label="Close"
      title="Close"
      onClick={onClick}
    >
      <CloseIcon />
    </button>
  );
}

export function SourceLink({ href }: { href: string }) {
  return (
    <p className="source-link">
      <span className="page-eyebrow" style={{ margin: 0 }}>
        Source
      </span>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="source-link-url"
      >
        {href}
      </a>
    </p>
  );
}

export function recipeEyebrow(meal: Meal, onCurrentWeek = false): string {
  if (meal.takeout) return "Takeout";
  if (meal.leftover) {
    return `Leftovers · ${DAY_LABELS[meal.day]} ${meal.slot}`;
  }
  if (onCurrentWeek || meal.planId) {
    return `${DAY_LABELS[meal.day]} ${meal.slot}`;
  }
  if (meal.sourceUrl) return `Imported ${meal.slot}`;
  return meal.slot;
}

export function RecipeFlyout({
  meal,
  servings,
  onClose,
  canSwap = true,
  eyebrow,
  showOpenFullRecipe = true,
  onRate,
}: {
  meal: Meal;
  servings: number;
  onClose: () => void;
  canSwap?: boolean;
  eyebrow?: string;
  showOpenFullRecipe?: boolean;
  onRate?: (stars: number) => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="recipe-flyout-root">
      <button
        type="button"
        className="recipe-backdrop"
        aria-label="Close recipe"
        onClick={onClose}
      />
      <aside className="recipe-flyout" role="dialog" aria-modal="true" aria-labelledby="recipe-flyout-title">
        <div className="mb-5 flex items-start justify-between gap-3">
          <p className="page-eyebrow" style={{ margin: 0 }}>
            {eyebrow ?? recipeEyebrow(meal)}
          </p>
          <CloseButton onClick={onClose} />
        </div>
        <h2
          id="recipe-flyout-title"
          className="mt-0 mb-2 flex items-start gap-2 text-[1.7rem] font-medium tracking-[-0.035em]"
        >
          <MealBadges meal={meal} />
          {meal.title}
        </h2>
        <p className="mt-0 mb-2 text-herb">{meal.whyItFits}</p>
        {!meal.draft ? (
          <div className="mb-3">
            <StarRating value={meal.stars} onChange={onRate} />
          </div>
        ) : null}
        <p className="mb-6 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-herb">
          Serves {servings} · {meal.cookMinutes} min · {meal.method}
        </p>
        {meal.sourceUrl ? <SourceLink href={meal.sourceUrl} /> : null}

        <section className="mb-6">
          <h3 className="page-eyebrow">Ingredients</h3>
          <ul className="mt-3">
            {meal.ingredients.map((ingredient, index) => (
              <li
                key={`${index}-${ingredient.quantity}-${ingredient.name}-${ingredient.unit}`}
                className="flex gap-3 border-b border-wheat/80 py-2 text-[0.95rem]"
              >
                <span className="w-24 shrink-0 font-mono text-[0.78rem] text-herb">
                  {ingredient.quantity} {ingredient.unit}
                </span>
                <span>{ingredient.name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8">
          <h3 className="page-eyebrow">Method</h3>
          <ol className="mt-3 space-y-3">
            {meal.steps.map((step, index) => (
              <li key={`${index}-${step}`} className="flex gap-3 text-[0.95rem] leading-relaxed">
                <span className="font-mono text-[0.72rem] text-olive">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          {showOpenFullRecipe ? (
            <Link href={`/meals/${meal.id}`} className="btn btn-primary no-underline">
              Open full recipe
            </Link>
          ) : null}
          {canSwap ? <SwapButton meal={meal} /> : null}
        </div>
      </aside>
    </div>
  );
}
