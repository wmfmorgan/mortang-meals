"use client";

import { useState } from "react";
import type { Meal, SlotMask, UseIngredient } from "@/lib/types";
import { hasAnySlot, maskMinusPinned } from "@/lib/slot-mask";
import { useGeneration } from "./generation-provider";

export function GenerateButton({
  disabledReason,
  weekStart,
  slotMask,
  pinnedMeals = [],
  useIngredients = [],
}: {
  disabledReason: string | null;
  weekStart?: string;
  slotMask: SlotMask;
  pinnedMeals?: Meal[];
  useIngredients?: UseIngredient[];
}) {
  const { state, startGenerate } = useGeneration();
  const [error, setError] = useState<string | null>(null);
  const pending = state.status === "running";
  const effectiveMask = maskMinusPinned(slotMask, pinnedMeals);
  const noSlots = !hasAnySlot(effectiveMask);
  const disabled = Boolean(disabledReason) || pending || noSlots;

  async function onGenerate() {
    if (disabled) return;
    setError(null);
    await startGenerate({
      weekStart,
      slotMask: effectiveMask,
      useIngredients,
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled}
        title={noSlots ? "Turn on at least one meal slot." : undefined}
        onClick={() => {
          void onGenerate();
        }}
      >
        {pending ? "Generating…" : "Generate"}
      </button>
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
