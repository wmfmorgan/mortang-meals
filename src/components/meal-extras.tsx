"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ExtraKind, ExtraMode, Meal, MealExtra } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";

const KIND_LABEL: Record<ExtraKind, string> = {
  side: "Side",
  dessert: "Dessert",
};

function extraLine(kind: ExtraKind, title: string): string {
  return `${KIND_LABEL[kind]} · ${title}`;
}

function ExtraAdd({
  mealId,
  kind,
}: {
  mealId: string;
  kind: ExtraKind;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ExtraMode>("suggestion");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId, kind, mode }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Couldn’t add that extra, try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("The model didn’t respond");
    } finally {
      setPending(false);
    }
  }

  const addLabel = kind === "side" ? "Add side" : "Add dessert";
  const pendingLabel = mode === "suggestion" ? "Suggesting…" : "Generating…";

  return (
    <div className="meal-extra-add" role="group" aria-label={`Add a ${kind}`}>
      <div className="meal-extra-toggle">
        <button
          type="button"
          className="meal-extra-mode"
          aria-pressed={mode === "suggestion"}
          disabled={pending}
          onClick={() => setMode("suggestion")}
        >
          Suggestion
        </button>
        <button
          type="button"
          className="meal-extra-mode"
          aria-pressed={mode === "recipe"}
          disabled={pending}
          onClick={() => setMode("recipe")}
        >
          Recipe
        </button>
      </div>
      <button
        type="button"
        className="meal-extra-add-btn"
        disabled={pending}
        onClick={() => {
          void onAdd();
        }}
      >
        {pending ? pendingLabel : addLabel}
      </button>
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
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
  const [pending, setPending] = useState<"recipe" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = extraLine(extra.kind, extra.title);

  async function postExtra(mode: ExtraMode) {
    const res = await fetch("/api/extra", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealId, kind: extra.kind, mode }),
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) {
      throw new Error(data.message ?? "Couldn’t add that extra, try again.");
    }
  }

  async function onGetRecipe() {
    setPending("recipe");
    setError(null);
    try {
      await postExtra("recipe");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The model didn’t respond",
      );
    } finally {
      setPending(null);
    }
  }

  async function onRemove() {
    setPending("delete");
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
      setPending(null);
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
          {extra.mode === "suggestion" ? (
            <button
              type="button"
              className="meal-extra-text-btn"
              disabled={pending !== null}
              onClick={() => {
                void onGetRecipe();
              }}
            >
              {pending === "recipe" ? "Generating…" : "Get recipe"}
            </button>
          ) : null}
          <button
            type="button"
            className="meal-extra-text-btn"
            aria-label={`Remove ${extra.kind}`}
            title={`Remove ${extra.kind}`}
            disabled={pending !== null}
            onClick={() => {
              void onRemove();
            }}
          >
            Remove
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
}: {
  meal: Meal;
  editable?: boolean;
  onOpenExtra?: (extra: MealExtra) => void;
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
        <ExtraAdd mealId={meal.id} kind="side" />
      ) : null}
      {extras.dessert ? (
        <ExtraRow
          mealId={meal.id}
          extra={extras.dessert}
          editable={editable}
          onOpenExtra={onOpenExtra}
        />
      ) : editable ? (
        <ExtraAdd mealId={meal.id} kind="dessert" />
      ) : null}
    </div>
  );
}
