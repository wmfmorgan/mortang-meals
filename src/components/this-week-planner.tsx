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
  UseIngredient,
  WeekPlan,
} from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { DAYS, SLOTS } from "@/lib/types";
import {
  defaultSlotMask,
  maskMinusPinned,
  readSessionMask,
  readSlotPickerOpen,
  writeSessionMask,
  writeSlotPickerOpen,
} from "@/lib/slot-mask";
import {
  readUseIngredients,
  writeUseIngredients,
} from "@/lib/use-ingredients";
import { GenerateButton } from "./generate-button";
import { useGeneration } from "./generation-provider";
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
  };
}

function extraRecipeEyebrow(meal: Meal, kind: ExtraKind): string {
  return `${recipeEyebrow(meal)} · ${kind}`;
}

export function ThisWeekPlanner({
  plan,
  weekStart,
  servings,
  disabledReason,
}: {
  plan: WeekPlan | null;
  weekStart?: string;
  servings: number;
  disabledReason: string | null;
}) {
  const router = useRouter();
  const { state: generation } = useGeneration();
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
  const [useIngredients, setUseIngredients] = useState<UseIngredient[]>([]);
  const [focusName, setFocusName] = useState("");
  const [focusDay, setFocusDay] = useState<DayOfWeek>("monday");
  const [focusSlot, setFocusSlot] = useState<MealSlot>("dinner");
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
    setUseIngredients(readUseIngredients());
  }, []);

  useEffect(() => {
    writeUseIngredients(useIngredients);
  }, [useIngredients]);

  useEffect(() => {
    const stored = readSlotPickerOpen();
    setPickerOpen(stored ?? !plan);
  }, [plan]);

  useEffect(() => {
    if (generation.status === "success") setUseIngredients([]);
  }, [generation.status]);

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
      <div className="flex flex-wrap items-center gap-2">
        <GenerateButton
          disabledReason={disabledReason}
          weekStart={weekStart}
          slotMask={slotMask}
          pinnedMeals={pinnedMeals}
          useIngredients={useIngredients}
        />
        {editable && plan && plan.meals.length > 0 ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pinPending}
            onClick={() => {
              void onPinAll();
            }}
          >
            {allPinned ? "Unpin all" : "Pin all"}
          </button>
        ) : null}
      </div>
      {editable ? (
        <form
          className="surface space-y-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const name = focusName.trim();
            if (!name) return;
            setUseIngredients((current) => [
              ...current,
              { name, day: focusDay, slot: focusSlot },
            ]);
            setFocusName("");
          }}
        >
          <p className="page-eyebrow" style={{ margin: 0 }}>
            Use what I have
          </p>
          <p className="m-0 text-sm text-herb">
            Point an ingredient at a specific meal, e.g. chicken on Monday
            dinner.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="field min-w-[10rem] flex-1">
              Ingredient
              <input
                className="input"
                value={focusName}
                onChange={(event) => setFocusName(event.target.value)}
                placeholder="chicken"
              />
            </label>
            <label className="field">
              Day
              <select
                className="input"
                value={focusDay}
                onChange={(event) =>
                  setFocusDay(event.target.value as DayOfWeek)
                }
              >
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Meal
              <select
                className="input"
                value={focusSlot}
                onChange={(event) =>
                  setFocusSlot(event.target.value as MealSlot)
                }
              >
                {SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-secondary">
              Add
            </button>
          </div>
          {useIngredients.length > 0 ? (
            <ul className="use-ingredient-chips">
              {useIngredients.map((item, index) => (
                <li key={`${item.day}-${item.slot}-${item.name}-${index}`}>
                  <span>
                    {item.name} · {item.day} {item.slot}
                  </span>
                  <button
                    type="button"
                    className="icon-button icon-button-danger"
                    aria-label={`Remove ${item.name} from ${item.day} ${item.slot}`}
                    onClick={() =>
                      setUseIngredients((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>
      ) : null}
      {!editable ? (
        <p className="text-sm text-herb">
          This is an older plan. Switch to the current week to pin or replace meals.
        </p>
      ) : null}
      <WeekGrid
        plan={plan}
        onSelectMeal={(meal) => setSelected({ type: "meal", mealId: meal.id })}
        onSelectExtra={(meal, extra) =>
          setSelected({ type: "extra", mealId: meal.id, kind: extra.kind })
        }
        onAdd={(day, slot) => setLibrary({ type: "week", day, slot })}
        onReplace={(meal) =>
          setLibrary({ type: "week", day: meal.day, slot: meal.slot })
        }
        onChooseExtra={(meal, kind) =>
          setLibrary({ type: "extra", mealId: meal.id, kind })
        }
        editable={editable}
        useIngredients={useIngredients}
      />
      {openMeal ? (
        <RecipeFlyout
          meal={openMeal}
          servings={servings}
          onClose={() => setSelected(null)}
          canSwap={selected?.type === "meal"}
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
