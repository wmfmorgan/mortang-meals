"use client";

import { useMemo, useState } from "react";
import type { Meal, MealSlot } from "@/lib/types";
import { SLOTS } from "@/lib/types";
import { filterCatalogMeals, groupCatalogMeals, mealDate } from "@/meals/catalog";
import { useGeneration } from "./generation-provider";
import { MealBadges } from "./meal-card";
import { RecipeFlyout, recipeEyebrow } from "./recipe-flyout";

type GroupBy = "slot" | "date" | "none";

export function MealsCatalog({
  meals,
  servings,
  currentPlanId,
}: {
  meals: Meal[];
  servings: number;
  currentPlanId: string | null;
}) {
  const { state, startImport } = useGeneration();
  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState<MealSlot | "all">("all");
  const [date, setDate] = useState<string | "all">("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("slot");
  const [url, setUrl] = useState("");
  const [importSlot, setImportSlot] = useState<MealSlot>("dinner");
  const [selected, setSelected] = useState<Meal | null>(null);

  const dates = useMemo(() => {
    return [...new Set(meals.map(mealDate))].sort((a, b) => b.localeCompare(a));
  }, [meals]);

  const filtered = filterCatalogMeals(meals, { search, slot, date });
  const groups = groupCatalogMeals(filtered, groupBy);
  const openMeal = selected
    ? (meals.find((item) => item.id === selected.id) ?? selected)
    : null;
  const pending = state.status === "running";

  async function onImport(event: React.FormEvent) {
    event.preventDefault();
    const next = url.trim();
    if (!next) return;
    setUrl("");
    await startImport({ url: next, slot: importSlot });
  }

  return (
    <div className="space-y-6">
      <form className="surface space-y-3 p-5" onSubmit={onImport}>
        <h2 className="mt-0 mb-1 text-xl font-medium tracking-[-0.03em]">
          Import from URL
        </h2>
        <p className="mt-0 text-sm text-herb">
          Grok reads the page and saves it as a normal meal, with a link back
          to the source.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="field min-w-[16rem] flex-1">
            Recipe URL
            <input
              className="input"
              type="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
            />
          </label>
          <label className="field">
            Meal
            <select
              className="input"
              value={importSlot}
              onChange={(event) =>
                setImportSlot(event.target.value as MealSlot)
              }
            >
              {SLOTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending && state.kind === "import" ? "Importing…" : "Import"}
          </button>
        </div>
      </form>

      <div className="surface flex flex-wrap items-end gap-3 p-4">
        <label className="field min-w-[12rem] flex-1">
          Search
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="title, ingredient, method"
          />
        </label>
        <label className="field">
          Meal
          <select
            className="input"
            value={slot}
            onChange={(event) =>
              setSlot(event.target.value as MealSlot | "all")
            }
          >
            <option value="all">all</option>
            {SLOTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Date
          <select
            className="input"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          >
            <option value="all">all</option>
            {dates.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Group by
          <select
            className="input"
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as GroupBy)}
          >
            <option value="slot">breakfast / lunch / dinner</option>
            <option value="date">date generated</option>
            <option value="none">none</option>
          </select>
        </label>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-herb">No meals match those filters.</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-3">
            {group.label ? <h2 className="page-eyebrow">{group.label}</h2> : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.meals.map((meal) => (
                <button
                  key={meal.id}
                  type="button"
                  className="meal-card meal-card-open text-left"
                  data-slot={meal.slot}
                  onClick={() => setSelected(meal)}
                >
                  <h3 className="mt-0 mb-0 flex items-start gap-2">
                    <MealBadges meal={meal} />
                    <span className="meal-card-title">{meal.title}</span>
                  </h3>
                  <p className="meal-meta">
                    {meal.slot} · {meal.cookMinutes} min · {meal.method}
                  </p>
                  <p className="meal-why">{meal.whyItFits}</p>
                  <p className="meal-meta">{mealDate(meal)}</p>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {openMeal ? (
        <RecipeFlyout
          meal={openMeal}
          servings={servings}
          onClose={() => setSelected(null)}
          canSwap={Boolean(currentPlanId && openMeal.planId === currentPlanId)}
          eyebrow={recipeEyebrow(
            openMeal,
            Boolean(currentPlanId && openMeal.planId === currentPlanId),
          )}
        />
      ) : null}
    </div>
  );
}
