"use client";

import type { Meal, Person } from "@/lib/types";
import { findAllergen } from "@/meals/allergen";
import { DeleteButton } from "./meal-card";
import { MealImage } from "./meal-image";
import { StarRating } from "./star-rating";

function slotLabel(slot: Meal["slot"]): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export function LibraryRecipeCard({
  meal,
  people = [],
  onOpen,
  onCook,
  onAddToPlan,
  onRate,
}: {
  meal: Meal;
  people?: Person[];
  onOpen: (meal: Meal) => void;
  onCook: (meal: Meal) => void;
  onAddToPlan: (meal: Meal) => void;
  onRate?: (stars: number) => void;
}) {
  const allergen = findAllergen(
    meal.ingredients,
    people.flatMap((person) => person.allergies),
  );
  const ingredientMeta = meal.ingredients
    .slice(0, 2)
    .map((item) => item.name)
    .join(" • ");

  return (
    <article className="library-card">
      <button
        type="button"
        className="library-card-open"
        onClick={() => onOpen(meal)}
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
        <div className="library-card-meta">
          <span className="library-card-meta-ings">{ingredientMeta}</span>
          <div
            className="library-card-rating"
            onClick={(event) => event.stopPropagation()}
          >
            <StarRating value={meal.stars} onChange={onRate} />
          </div>
        </div>
        <h3 className="library-card-title">{meal.title}</h3>
        <p className="library-card-why">{meal.whyItFits}</p>
        <p className="library-card-servings">Servings: {meal.servings}</p>
        {allergen ? (
          <p role="alert" className="alert library-pill">
            {allergen}
          </p>
        ) : null}
      </div>
      <div className="library-card-actions">
        <button
          type="button"
          className="btn btn-secondary library-pill"
          onClick={(event) => {
            event.stopPropagation();
            onAddToPlan(meal);
          }}
        >
          + Add to Plan
        </button>
        <button
          type="button"
          className="btn btn-primary library-pill"
          onClick={(event) => {
            event.stopPropagation();
            onCook(meal);
          }}
        >
          Cook
        </button>
        <DeleteButton
          meal={meal}
          icon="trash"
          confirmMessage="Delete this meal from the library?"
        />
      </div>
    </article>
  );
}
