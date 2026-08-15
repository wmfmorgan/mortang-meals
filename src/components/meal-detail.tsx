"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Aisle, Ingredient, Meal } from "@/lib/types";
import { AISLES } from "@/lib/types";
import { PageHeader } from "./page-header";
import { MealBadges, SwapButton } from "./meal-card";

function emptyIngredient(): Ingredient {
  return { name: "", quantity: "", unit: "", aisle: "other" };
}

export function MealDetail({
  meal,
  servings,
  canSwap,
  eyebrow,
}: {
  meal: Meal;
  servings: string;
  canSwap: boolean;
  eyebrow: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(meal.title);
  const [whyItFits, setWhyItFits] = useState(meal.whyItFits);
  const [cookMinutes, setCookMinutes] = useState(String(meal.cookMinutes));
  const [method, setMethod] = useState(meal.method);
  const [ingredients, setIngredients] = useState<Ingredient[]>(meal.ingredients);
  const [steps, setSteps] = useState<string[]>(meal.steps);

  function resetForm() {
    setTitle(meal.title);
    setWhyItFits(meal.whyItFits);
    setCookMinutes(String(meal.cookMinutes));
    setMethod(meal.method);
    setIngredients(meal.ingredients);
    setSteps(meal.steps);
    setError(null);
    setEditing(false);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mealId: meal.id,
          title: title.trim(),
          whyItFits: whyItFits.trim(),
          cookMinutes: Number(cookMinutes),
          method: method.trim(),
          ingredients: ingredients.map((item) => ({
            ...item,
            name: item.name.trim(),
            quantity: item.quantity.trim(),
            unit: item.unit.trim(),
          })),
          steps: steps.map((step) => step.trim()).filter(Boolean),
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Couldn’t save those changes.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn’t save those changes.");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this meal from the library?")) return;
    setPending(true);
    try {
      const res = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId: meal.id }),
      });
      if (!res.ok) return;
      router.push("/meals");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const actions = editing ? (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => {
          void onSave();
        }}
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={resetForm}
      >
        Cancel
      </button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      {canSwap ? <SwapButton meal={meal} /> : null}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setEditing(true)}
      >
        Edit
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() => {
          void onDelete();
        }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={
          <span className="inline-flex items-center gap-2">
            <MealBadges meal={meal} />
            {editing ? "Edit recipe" : meal.title}
          </span>
        }
        lede={editing ? undefined : meal.whyItFits}
        action={actions}
      />
      {error ? (
        <p role="alert" className="alert mb-6">
          {error}
        </p>
      ) : null}

      {editing ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="field sm:col-span-2">
              Title
              <input
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>
            <label className="field sm:col-span-2">
              Why it fits
              <textarea
                className="input"
                rows={3}
                value={whyItFits}
                onChange={(event) => setWhyItFits(event.target.value)}
                required
              />
            </label>
            <label className="field">
              Cook minutes
              <input
                className="input"
                type="number"
                min={1}
                value={cookMinutes}
                onChange={(event) => setCookMinutes(event.target.value)}
                required
              />
            </label>
            <label className="field">
              Method
              <input
                className="input"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                required
              />
            </label>
          </div>

          <section className="surface space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="page-eyebrow" style={{ margin: 0 }}>
                Ingredients
              </h2>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setIngredients((list) => [...list, emptyIngredient()])}
              >
                Add ingredient
              </button>
            </div>
            <ul className="space-y-3">
              {ingredients.map((ingredient, index) => (
                <li key={index} className="grid gap-2 sm:grid-cols-[6rem_6rem_1fr_8rem_auto]">
                  <label className="field">
                    Qty
                    <input
                      className="input"
                      value={ingredient.quantity}
                      onChange={(event) =>
                        setIngredients((list) =>
                          list.map((item, i) =>
                            i === index ? { ...item, quantity: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Unit
                    <input
                      className="input"
                      value={ingredient.unit}
                      onChange={(event) =>
                        setIngredients((list) =>
                          list.map((item, i) =>
                            i === index ? { ...item, unit: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Name
                    <input
                      className="input"
                      value={ingredient.name}
                      onChange={(event) =>
                        setIngredients((list) =>
                          list.map((item, i) =>
                            i === index ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    Aisle
                    <select
                      className="input"
                      value={ingredient.aisle}
                      onChange={(event) =>
                        setIngredients((list) =>
                          list.map((item, i) =>
                            i === index
                              ? { ...item, aisle: event.target.value as Aisle }
                              : item,
                          ),
                        )
                      }
                    >
                      {AISLES.map((aisle) => (
                        <option key={aisle} value={aisle}>
                          {aisle}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost self-end"
                    onClick={() =>
                      setIngredients((list) => list.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="page-eyebrow" style={{ margin: 0 }}>
                Method
              </h2>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSteps((list) => [...list, ""])}
              >
                Add step
              </button>
            </div>
            <ol className="space-y-3">
              {steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-3 font-mono text-[0.72rem] text-olive">
                    {index + 1}
                  </span>
                  <textarea
                    className="input flex-1"
                    rows={2}
                    value={step}
                    onChange={(event) =>
                      setSteps((list) =>
                        list.map((item, i) => (i === index ? event.target.value : item)),
                      )
                    }
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={index === 0}
                      onClick={() =>
                        setSteps((list) => {
                          const next = [...list];
                          [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                          return next;
                        })
                      }
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={index === steps.length - 1}
                      onClick={() =>
                        setSteps((list) => {
                          const next = [...list];
                          [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                          return next;
                        })
                      }
                    >
                      Down
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setSteps((list) => list.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </form>
      ) : (
        <>
          <p className="mb-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-herb">
            {servings}
            {` · ${meal.cookMinutes} min · ${meal.method}`}
          </p>
          {meal.sourceUrl ? (
            <p className="mb-8">
              <a
                href={meal.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-olive"
              >
                Source recipe
              </a>
            </p>
          ) : null}

          <div className="surface grid gap-8 p-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:p-8">
            <section>
              <h2 className="page-eyebrow">Ingredients</h2>
              <ul className="mt-3 space-y-2">
                {meal.ingredients.map((ingredient) => (
                  <li
                    key={`${ingredient.name}-${ingredient.unit}`}
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
            <section>
              <h2 className="page-eyebrow">Method</h2>
              <ol className="mt-3 space-y-3">
                {meal.steps.map((step, index) => (
                  <li
                    key={`${index}-${step}`}
                    className="flex gap-3 text-[0.98rem] leading-relaxed"
                  >
                    <span className="font-mono text-[0.72rem] text-olive">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </>
      )}
    </>
  );
}
