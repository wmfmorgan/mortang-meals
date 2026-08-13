"use client";

import { useEffect, useState } from "react";
import type { Meal, SlotMask, WeekPlan } from "@/lib/types";
import {
  defaultSlotMask,
  readSessionMask,
  writeSessionMask,
} from "@/lib/slot-mask";
import { GenerateButton } from "./generate-button";
import { RecipeFlyout } from "./recipe-flyout";
import { SlotPicker } from "./slot-picker";
import { WeekGrid } from "./week-grid";

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
  const [slotMask, setSlotMask] = useState<SlotMask>(
    () => plan?.slotMask ?? defaultSlotMask(),
  );
  const [selected, setSelected] = useState<Meal | null>(null);

  useEffect(() => {
    const stored = readSessionMask();
    if (stored) setSlotMask(stored);
  }, []);

  useEffect(() => {
    writeSessionMask(slotMask);
  }, [slotMask]);

  const openMeal =
    selected && plan
      ? (plan.meals.find((meal) => meal.id === selected.id) ?? selected)
      : selected;

  return (
    <div className="space-y-6">
      <SlotPicker value={slotMask} onChange={setSlotMask} />
      <GenerateButton
        disabledReason={disabledReason}
        weekStart={weekStart}
        slotMask={slotMask}
      />
      <WeekGrid plan={plan} onSelectMeal={setSelected} />
      {openMeal ? (
        <RecipeFlyout
          meal={openMeal}
          servings={servings}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
