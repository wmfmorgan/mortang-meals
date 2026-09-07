"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExtraKind, Meal, MealExtra } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";

const KIND_LABEL: Record<ExtraKind, string> = {
  side: "Side",
  dessert: "Dessert",
};

function extraLine(kind: ExtraKind, title: string): string {
  return `${KIND_LABEL[kind]} · ${title}`;
}

function ExtraAdd({
  kind,
  onChoosePast,
}: {
  kind: ExtraKind;
  onChoosePast?: (kind: ExtraKind) => void;
}) {
  if (!onChoosePast) return null;
  return (
    <div className="meal-extra-add" role="group" aria-label={`Add a ${kind}`}>
      <button
        type="button"
        className="meal-extra-open"
        onClick={() => onChoosePast(kind)}
      >
        {kind === "side" ? "Add side" : "Add dessert"}
      </button>
    </div>
  );
}

function ExtraRow({
  mealId,
  extra,
  editable,
  onOpenExtra,
}: {
  mealId: string;
  extra: MealExtra;
  editable: boolean;
  onOpenExtra?: (extra: MealExtra) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = extraLine(extra.kind, extra.title);

  async function onRemove() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/extra", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId, kind: extra.kind }),
      });
      if (!res.ok) return;
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="meal-extra-row">
      {extra.mode === "recipe" ? (
        <button
          type="button"
          className="meal-extra-open"
          onClick={(event) => {
            event.stopPropagation();
            onOpenExtra?.(extra);
          }}
        >
          {label}
        </button>
      ) : (
        <p className="meal-extra-title">{label}</p>
      )}
      {editable ? (
        <div className="meal-extra-tools">
          <button
            type="button"
            className="icon-button icon-button-danger"
            aria-label={`Remove ${extra.kind}`}
            title={`Remove ${extra.kind}`}
            disabled={pending}
            onClick={() => {
              void onRemove();
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MealExtras({
  meal,
  editable = false,
  onOpenExtra,
  onChoosePast,
}: {
  meal: Meal;
  editable?: boolean;
  onOpenExtra?: (extra: MealExtra) => void;
  onChoosePast?: (kind: ExtraKind) => void;
}) {
  if (meal.slot === "breakfast") return null;
  const extras = meal.extras ?? EMPTY_EXTRAS;
  if (!extras.side && !extras.dessert && !editable) return null;

  return (
    <div className="meal-extras">
      {extras.side ? (
        <ExtraRow
          mealId={meal.id}
          extra={extras.side}
          editable={editable}
          onOpenExtra={onOpenExtra}
        />
      ) : editable ? (
        <ExtraAdd kind="side" onChoosePast={onChoosePast} />
      ) : null}
      {extras.dessert ? (
        <ExtraRow
          mealId={meal.id}
          extra={extras.dessert}
          editable={editable}
          onOpenExtra={onOpenExtra}
        />
      ) : editable ? (
        <ExtraAdd kind="dessert" onChoosePast={onChoosePast} />
      ) : null}
    </div>
  );
}
