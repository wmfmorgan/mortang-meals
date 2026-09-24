"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cookMealHref } from "@/lib/cook-exit";
import type { DayOfWeek, Meal, Person } from "@/lib/types";
import {
  filterCatalogMeals,
  groupCatalogMeals,
  mealMatchesChip,
  sortCatalogMeals,
  type CatalogChip,
  type CatalogGroupBy,
  type CatalogSort,
} from "@/meals/catalog";
import { AddRecipeModal } from "./add-recipe-modal";
import { AddToPlanDrawer } from "./add-to-plan-drawer";
import { CollapsibleCard } from "./collapsible-card";
import { DraftQueue } from "./draft-queue";
import { LibraryRecipeCard } from "./library-recipe-card";
import { RecipeFlyout, recipeEyebrow } from "./recipe-flyout";

const CHIPS: { id: CatalogChip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "safe", label: "All Safe" },
  { id: "quick", label: "Under 20m" },
  { id: "sheet", label: "Sheet Pan" },
  { id: "slow", label: "Slow Cooker" },
];

const GROUPS: { id: Extract<CatalogGroupBy, "none" | "slot" | "method">; label: string }[] = [
  { id: "none", label: "All" },
  { id: "slot", label: "Meal Type" },
  { id: "method", label: "Method" },
];

function weekdayName(day: DayOfWeek): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function allergyPeopleNames(people: Person[]): string[] {
  return people
    .filter(
      (person) =>
        person.name.trim() && person.allergies.some((term) => term.trim()),
    )
    .map((person) => person.name.trim());
}

export function MealsCatalog({
  meals,
  drafts = [],
  people = [],
  householdName = "",
  servings,
  currentPlanId,
  weekStart,
}: {
  meals: Meal[];
  drafts?: Meal[];
  people?: Person[];
  householdName?: string;
  servings: number;
  currentPlanId: string | null;
  weekStart: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<Extract<CatalogGroupBy, "none" | "slot" | "method">>("slot");
  const [sort, setSort] = useState<CatalogSort>("loved");
  const [chip, setChip] = useState<CatalogChip>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [chipsOpen, setChipsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState<Meal | null>(null);
  const [selected, setSelected] = useState<Meal | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const allergies = people.flatMap((person) => person.allergies);
  const visible = sortCatalogMeals(
    filterCatalogMeals(meals, { search }).filter((item) =>
      mealMatchesChip(item, chip, allergies),
    ),
    sort,
  );
  const groups = groupCatalogMeals(visible, groupBy);
  const openMeal = selected
    ? (meals.find((item) => item.id === selected.id) ?? selected)
    : null;
  const allergyNames = allergyPeopleNames(people);
  const lede = allergyNames.length
    ? `Allergies for ${allergyNames.join(" & ")} stay excluded on generate.`
    : householdName
      ? `Favorite household recipes and weeknight ideas for ${householdName}.`
      : "Favorite household recipes and weeknight ideas.";
  const hasAllergies = allergies.some((term) => term.trim());
  const gridClass = view === "list" ? "library-grid is-list" : "library-grid";

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function onRate(mealId: string, stars: number) {
    await fetch("/api/library/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealId, stars }),
    });
    router.refresh();
  }

  function renderGrid(items: Meal[]) {
    return (
      <div className={gridClass}>
        {items.map((item) => (
          <LibraryRecipeCard
            key={item.id}
            meal={item}
            people={people}
            onOpen={setSelected}
            onCook={(next) => router.push(cookMealHref(next.id, "meals"))}
            onAddToPlan={setPlacing}
            onRate={(stars) => {
              void onRate(item.id, stars);
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="library-page">
      <header className="library-hero">
        <div className="library-hero-copy">
          <div className="library-hero-kicker">
            <p className="page-eyebrow" style={{ margin: 0 }}>
              Household Collection
            </p>
            {householdName ? (
              <span className="library-hero-household">{householdName}</span>
            ) : null}
          </div>
          <h1 className="page-title">Recipe Library</h1>
          <p className="page-lede">{lede}</p>
        </div>
        <div className="library-hero-actions">
          <button
            type="button"
            className="btn btn-secondary library-pill library-filter-toggle"
            aria-pressed={chipsOpen}
            onClick={() => setChipsOpen((open) => !open)}
          >
            Filter
          </button>
          <button
            type="button"
            className="btn btn-primary library-pill"
            onClick={() => setAdding(true)}
          >
            New Recipe
          </button>
        </div>
      </header>

      <div className="library-toolbar">
        <div className="library-toolbar-row">
          <label className="field library-search-field">
            Search
            <input
              className="input library-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="title, ingredient, method"
            />
          </label>
          <div className="library-group-control">
            <span className="page-eyebrow" style={{ margin: 0 }}>
              Group
            </span>
            <div className="library-segmented" role="group" aria-label="Group">
              {GROUPS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={groupBy === item.id}
                  onClick={() => setGroupBy(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            Sort
            <select
              className="input"
              value={sort}
              onChange={(event) => setSort(event.target.value as CatalogSort)}
            >
              <option value="loved">Most Loved</option>
              <option value="fast">Under 20 Mins</option>
              <option value="recent">Recently Cooked</option>
            </select>
          </label>
          <div className="library-view-toggle" role="group" aria-label="View">
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              Grid
            </button>
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              List
            </button>
          </div>
        </div>
        <div
          className={chipsOpen ? "library-chips is-open" : "library-chips"}
          role="group"
          aria-label="Filters"
        >
          {CHIPS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="library-chip"
              aria-pressed={chip === item.id}
              onClick={() => setChip(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="library-status">
        <span>
          Showing {visible.length} recipe{visible.length === 1 ? "" : "s"}
        </span>
        {hasAllergies ? (
          <span className="library-pill library-status-pill">Allergies checked</span>
        ) : null}
      </div>

      {drafts.length > 0 ? (
        <DraftQueue drafts={drafts} servings={servings} />
      ) : null}

      {groups.length === 0 ? (
        <p className="text-sm text-herb">No meals match those filters.</p>
      ) : (
        groups.map((group) => {
          const grid = renderGrid(group.meals);
          if (!group.label) {
            return (
              <section key={group.key} className="space-y-3">
                {grid}
              </section>
            );
          }
          return (
            <CollapsibleCard
              key={group.key}
              title={group.label}
              defaultOpen
              tone="section"
            >
              {grid}
            </CollapsibleCard>
          );
        })
      )}

      {openMeal ? (
        <RecipeFlyout
          meal={openMeal}
          servings={servings}
          onClose={() => setSelected(null)}
          canSwap={Boolean(currentPlanId && openMeal.planId === currentPlanId)}
          from="meals"
          eyebrow={recipeEyebrow(
            openMeal,
            Boolean(currentPlanId && openMeal.planId === currentPlanId),
          )}
          onRate={(stars) => {
            void onRate(openMeal.id, stars);
          }}
        />
      ) : null}

      {adding ? (
        <AddRecipeModal
          people={people}
          servings={servings}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {placing ? (
        <AddToPlanDrawer
          meal={placing}
          weekStart={weekStart}
          onPlaced={(day, slot) => {
            setToast(`Added to ${weekdayName(day)} ${slot}`);
            setPlacing(null);
            router.refresh();
          }}
          onClose={() => setPlacing(null)}
        />
      ) : null}

      {toast ? (
        <p className="library-toast" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
