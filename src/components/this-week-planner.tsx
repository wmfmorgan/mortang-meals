"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DayOfWeek,
  ExtraKind,
  Meal,
  MealExtra,
  MealSlot,
  SlotMask,
  WeekPlan,
} from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import {
  defaultSlotMask,
  maskMinusPinned,
  readSessionMask,
  readSlotPickerOpen,
  writeSessionMask,
  writeSlotPickerOpen,
} from "@/lib/slot-mask";
import { MealLibraryFlyout } from "./meal-library-flyout";
import { RecipeFlyout, recipeEyebrow } from "./recipe-flyout";
import { SlotPicker } from "./slot-picker";
import { WeekGrid } from "./week-grid";

function extraAsMeal(parent: Meal, extra: MealExtra): Meal {
  return {
    ...parent,
    id: extra.id,
    title: extra.title,
    whyItFits: extra.whyItFits,
    cookMinutes: extra.cookMinutes,
    method: extra.method,
    ingredients: extra.ingredients,
    steps: extra.steps,
    usedWebSearch: extra.usedWebSearch,
    sourceUrl: extra.sourceUrl,
    extras: EMPTY_EXTRAS,
    draft: false,
    stars: 0,
    takeout: false,
    leftover: false,
  };
}

function extraRecipeEyebrow(meal: Meal, kind: ExtraKind): string {
  return `${recipeEyebrow(meal)} · ${kind}`;
}

export function ThisWeekPlanner({
  plan,
  weekStart,
  servings,
}: {
  plan: WeekPlan | null;
  weekStart?: string;
  servings: number;
}) {
  const router = useRouter();
  const [slotMask, setSlotMask] = useState<SlotMask>(
    () => plan?.slotMask ?? defaultSlotMask(),
  );
  const [selected, setSelected] = useState<
    | { type: "meal"; mealId: string }
    | { type: "extra"; mealId: string; kind: ExtraKind }
    | null
  >(null);
  const [library, setLibrary] = useState<
    | { type: "week"; day: DayOfWeek; slot: MealSlot }
    | { type: "extra"; mealId: string; kind: ExtraKind }
    | null
  >(null);
  const [pinPending, setPinPending] = useState(false);
  const [fillPending, setFillPending] = useState(false);
  const [allowRepeats, setAllowRepeats] = useState(false);
  const [leftoverLunches, setLeftoverLunches] = useState(false);
  const [maxProtein, setMaxProtein] = useState(2);
  const [leftoverFrom, setLeftoverFrom] = useState<Meal | null>(null);
  const [pickerOpen, setPickerOpen] = useState(() => !plan);

  const pinnedMeals = plan?.meals.filter((meal) => meal.pinned) ?? [];
  const pinKey = pinnedMeals
    .map((meal) => `${meal.day}:${meal.slot}`)
    .sort()
    .join(",");

  useEffect(() => {
    const stored = readSessionMask();
    const base = stored ?? plan?.slotMask ?? defaultSlotMask();
    setSlotMask(plan ? maskMinusPinned(base, plan.meals) : base);
  }, [plan, pinKey]);

  useEffect(() => {
    writeSessionMask(slotMask);
  }, [slotMask]);

  useEffect(() => {
    const stored = readSlotPickerOpen();
    setPickerOpen(stored ?? !plan);
  }, [plan]);

  const editable = !plan || plan.isCurrent;
  const selectedMeal =
    selected && plan
      ? (plan.meals.find((meal) => meal.id === selected.mealId) ?? null)
      : null;
  const selectedExtra =
    selected?.type === "extra" ? (selectedMeal?.extras[selected.kind] ?? null) : null;
  const openMeal =
    selectedExtra?.mode === "recipe" && selectedMeal
      ? extraAsMeal(selectedMeal, selectedExtra)
      : selected?.type === "meal"
        ? selectedMeal
        : null;
  const extraEyebrow =
    selected?.type === "extra" && selectedMeal && selectedExtra
      ? extraRecipeEyebrow(selectedMeal, selectedExtra.kind)
      : undefined;
  const allPinned =
    Boolean(plan && plan.meals.length > 0 && plan.meals.every((meal) => meal.pinned));

  async function onPinAll() {
    if (!plan || pinPending) return;
    setPinPending(true);
    try {
      await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, pinned: !allPinned }),
      });
      router.refresh();
    } finally {
      setPinPending(false);
    }
  }

  async function onFill() {
    setFillPending(true);
    try {
      await fetch("/api/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotMask,
          weekStart,
          planId: plan?.id,
          allowRepeats,
          leftoverLunches,
          maxProtein,
        }),
      });
      router.refresh();
    } finally {
      setFillPending(false);
    }
  }

  async function onTakeout(day: DayOfWeek, slot: MealSlot) {
    const title = window.prompt("Restaurant name (optional)", "");
    if (title === null) return;
    await fetch("/api/takeout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, slot, title, weekStart }),
    });
    router.refresh();
  }

  async function onPlaceLeftover(day: DayOfWeek, slot: MealSlot) {
    if (!leftoverFrom) return;
    await fetch("/api/leftover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceMealId: leftoverFrom.id,
        day,
        slot,
      }),
    });
    setLeftoverFrom(null);
    router.refresh();
  }

  async function onEditThisWeek() {
    if (!plan) return;
    await fetch("/api/plans/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: plan.weekStart }),
    });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <SlotPicker
        value={slotMask}
        onChange={setSlotMask}
        pinnedMeals={pinnedMeals}
        collapsible
        expanded={pickerOpen}
        onExpandedChange={(open) => {
          setPickerOpen(open);
          writeSlotPickerOpen(open);
        }}
      />
      {editable ? (
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={fillPending}
            onClick={() => void onFill()}
          >
            {fillPending ? "Filling…" : "Fill empty slots"}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowRepeats}
              onChange={(event) => setAllowRepeats(event.target.checked)}
            />
            Allow repeats
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={leftoverLunches}
              onChange={(event) => setLeftoverLunches(event.target.checked)}
            />
            Leftover lunches
          </label>
          <label className="field" style={{ width: "9rem" }}>
            Max protein / meal
            <input
              className="input"
              type="number"
              min={0}
              max={21}
              value={maxProtein}
              onChange={(event) =>
                setMaxProtein(Number(event.target.value) || 0)
              }
            />
          </label>
          {plan && plan.meals.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pinPending}
              onClick={() => {
                void onPinAll();
              }}
            >
              {allPinned ? "Unlock all" : "Lock all"}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="m-0 text-sm text-herb">
            This is an older plan. Open it to edit.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void onEditThisWeek()}
          >
            Edit this plan
          </button>
        </div>
      )}
      {leftoverFrom ? (
        <p className="m-0 text-sm text-herb">
          Place leftovers of {leftoverFrom.title} on an empty cell.{" "}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setLeftoverFrom(null)}
          >
            Cancel
          </button>
        </p>
      ) : null}
      <WeekGrid
        plan={plan}
        onSelectMeal={(meal) => setSelected({ type: "meal", mealId: meal.id })}
        onSelectExtra={(meal, extra) =>
          setSelected({ type: "extra", mealId: meal.id, kind: extra.kind })
        }
        onAdd={(day, slot) => setLibrary({ type: "week", day, slot })}
        onTakeout={(day, slot) => void onTakeout(day, slot)}
        onLeftover={(meal) => setLeftoverFrom(meal)}
        leftoverFrom={leftoverFrom}
        onPlaceLeftover={(day, slot) => void onPlaceLeftover(day, slot)}
        onReplace={(meal) =>
          setLibrary({ type: "week", day: meal.day, slot: meal.slot })
        }
        onChooseExtra={(meal, kind) =>
          setLibrary({ type: "extra", mealId: meal.id, kind })
        }
        editable={editable}
      />
      {openMeal ? (
        <RecipeFlyout
          meal={openMeal}
          servings={servings}
          onClose={() => setSelected(null)}
          canSwap={false}
          showOpenFullRecipe={
            selected?.type === "meal" || selectedExtra?.mode === "recipe"
          }
          eyebrow={extraEyebrow}
        />
      ) : null}
      {library?.type === "week" ? (
        <MealLibraryFlyout
          day={library.day}
          slot={library.slot}
          weekStart={weekStart}
          onClose={() => setLibrary(null)}
          onPlaced={() => router.refresh()}
        />
      ) : null}
      {library?.type === "extra" ? (
        <MealLibraryFlyout
          slot={library.kind}
          placeExtra={{ mealId: library.mealId, kind: library.kind }}
          onClose={() => setLibrary(null)}
          onPlaced={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
