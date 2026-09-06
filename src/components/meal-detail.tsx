"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Aisle, Ingredient, Meal, MealSlot } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { AISLES, RECIPE_SLOTS } from "@/lib/types";
import { PageHeader } from "./page-header";
import { MealBadges, SwapButton, TrashIcon } from "./meal-card";
import { SourceLink } from "./recipe-flyout";

function emptyIngredient(): Ingredient {
  return { name: "", quantity: "", unit: "", aisle: "other" };
}

const LEAVE_RECIPE_MESSAGE =
  "Leave without saving? Your changes will be lost.";

const EMPTY_DRAFT: Meal = {
  id: "",
  planId: "",
  day: "monday",
  slot: "dinner",
  title: "",
  whyItFits: "",
  cookMinutes: 30,
  method: "",
  ingredients: [emptyIngredient()],
  steps: [""],
  usedWebSearch: false,
  pinned: false,
  createdAt: "",
  sourceUrl: null,
  extras: EMPTY_EXTRAS,
};

export function MealDetail({
  meal,
  servings,
  canSwap,
  eyebrow,
  mode = "edit",
}: {
  meal?: Meal;
  servings: string;
  canSwap: boolean;
  eyebrow: string;
  mode?: "edit" | "create";
}) {
  const creating = mode === "create";
  const source = meal ?? EMPTY_DRAFT;
  const router = useRouter();
  const [editing, setEditing] = useState(creating);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(source.title);
  const [whyItFits, setWhyItFits] = useState(source.whyItFits);
  const [cookMinutes, setCookMinutes] = useState(String(source.cookMinutes));
  const [method, setMethod] = useState(source.method);
  const [slot, setSlot] = useState<MealSlot>(source.slot);
  const [ingredients, setIngredients] = useState<Ingredient[]>(source.ingredients);
  const [steps, setSteps] = useState<string[]>(source.steps);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const dirty =
    editing &&
    (title !== source.title ||
      whyItFits !== source.whyItFits ||
      cookMinutes !== String(source.cookMinutes) ||
      method !== source.method ||
      slot !== source.slot ||
      JSON.stringify(steps) !== JSON.stringify(source.steps) ||
      JSON.stringify(ingredients) !== JSON.stringify(source.ingredients));

  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function onDocumentClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }
      if (!window.confirm(LEAVE_RECIPE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [dirty]);

  function moveStep(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setSteps((list) => {
      if (from >= list.length || to >= list.length) return list;
      const next = [...list];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });
  }

  function resetForm() {
    if (creating) {
      if (dirty && !window.confirm(LEAVE_RECIPE_MESSAGE)) return;
      router.push("/meals");
      return;
    }
    setTitle(source.title);
    setWhyItFits(source.whyItFits);
    setCookMinutes(String(source.cookMinutes));
    setMethod(source.method);
    setSlot(source.slot);
    setIngredients(source.ingredients);
    setSteps(source.steps);
    setError(null);
    setEditing(false);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    const fields = {
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
    };
    try {
      const res = await fetch(creating ? "/api/create" : "/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          creating ? { ...fields, slot } : { mealId: source.id, ...fields },
        ),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Couldn’t save those changes.");
        return;
      }
      if (creating) {
        router.push("/meals");
        router.refresh();
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
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="submit"
        form="recipe-edit-form"
        className="btn btn-primary"
        disabled={pending}
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
    <div className="no-print flex flex-wrap items-center gap-2">
      <PrintButton />
      {canSwap && meal ? <SwapButton meal={meal} /> : null}
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
            {meal ? <MealBadges meal={meal} /> : null}
            {creating ? "Add recipe" : editing ? "Edit recipe" : source.title}
          </span>
        }
        lede={editing ? undefined : source.whyItFits}
        action={actions}
      />
      {error ? (
        <p role="alert" className="alert mb-6">
          {error}
        </p>
      ) : null}

      {editing ? (
        <form
          id="recipe-edit-form"
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
                required={!creating}
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
            {creating ? (
              <label className="field">
                Meal
                <select
                  className="input"
                  value={slot}
                  required
                  onChange={(event) =>
                    setSlot(event.target.value as MealSlot)
                  }
                >
                  {RECIPE_SLOTS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
                    className="icon-button icon-button-danger self-end"
                    aria-label={`Delete ingredient ${index + 1}`}
                    title="Delete ingredient"
                    onClick={() =>
                      setIngredients((list) =>
                        list.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <TrashIcon />
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
                <li
                  key={index}
                  className={`step-row flex items-start gap-2${
                    dragFrom === index ? " step-row-dragging" : ""
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    let transferred = Number.NaN;
                    try {
                      transferred = Number(
                        event.dataTransfer?.getData("text/plain") ?? "",
                      );
                    } catch {
                      transferred = Number.NaN;
                    }
                    const from = dragFrom ?? transferred;
                    moveStep(from, index);
                    setDragFrom(null);
                  }}
                >
                  <button
                    type="button"
                    className="icon-button step-grip"
                    draggable
                    aria-label={`Reorder step ${index + 1}`}
                    title="Drag to reorder"
                    onDragStart={(event) => {
                      setDragFrom(index);
                      try {
                        if (event.dataTransfer) {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "text/plain",
                            String(index),
                          );
                        }
                      } catch {
                        // happy-dom may expose a read-only DataTransfer
                      }
                    }}
                    onDragEnd={() => setDragFrom(null)}
                  >
                    <GripIcon />
                  </button>
                  <span className="mt-3 font-mono text-[0.72rem] text-olive">
                    {index + 1}
                  </span>
                  <textarea
                    className="input flex-1"
                    rows={2}
                    aria-label={`Step ${index + 1}`}
                    value={step}
                    onChange={(event) =>
                      setSteps((list) =>
                        list.map((item, i) =>
                          i === index ? event.target.value : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-button icon-button-danger"
                    aria-label={`Delete step ${index + 1}`}
                    title="Delete step"
                    onClick={() =>
                      setSteps((list) => list.filter((_, i) => i !== index))
                    }
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </form>
      ) : (
        <>
          <p className="mb-4 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-herb">
            {servings}
            {` · ${source.cookMinutes} min · ${source.method}`}
          </p>
          {source.sourceUrl ? <SourceLink href={source.sourceUrl} /> : null}

          <div className="surface grid gap-8 p-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:p-8">
            <section>
              <h2 className="page-eyebrow">Ingredients</h2>
              <ul className="mt-3 space-y-2">
                {source.ingredients.map((ingredient, index) => (
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
            <section>
              <h2 className="page-eyebrow">Method</h2>
              <ol className="mt-3 space-y-3">
                {source.steps.map((step, index) => (
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

function PrintButton() {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label="Print recipe"
      title="Print recipe"
      onClick={() => window.print()}
    >
      <PrinterIcon />
    </button>
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="currentColor"
    >
      <circle cx="7" cy="5" r="1.35" />
      <circle cx="13" cy="5" r="1.35" />
      <circle cx="7" cy="10" r="1.35" />
      <circle cx="13" cy="10" r="1.35" />
      <circle cx="7" cy="15" r="1.35" />
      <circle cx="13" cy="15" r="1.35" />
    </svg>
  );
}

function PrinterIcon() {
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
      <path d="M5.2 7.2V3.4h9.6v3.8" />
      <path d="M5.2 14.2H3.8A1.4 1.4 0 0 1 2.4 12.8V8.6A1.4 1.4 0 0 1 3.8 7.2h12.4A1.4 1.4 0 0 1 17.6 8.6v4.2a1.4 1.4 0 0 1-1.4 1.4h-1.4" />
      <rect x="5.2" y="11.6" width="9.6" height="5" rx="0.8" />
    </svg>
  );
}
