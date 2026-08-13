"use client";

import { useState } from "react";
import type { SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { useGeneration } from "./generation-provider";

const SLOT_MASK_KEY = "mortang.slotMask";

function defaultSlotMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      { breakfast: false, lunch: false, dinner: true },
    ]),
  ) as SlotMask;
}

function hasAnySlot(mask: SlotMask): boolean {
  return DAYS.some((day) => SLOTS.some((slot) => Boolean(mask[day]?.[slot])));
}

function readSessionMask(): SlotMask | null {
  try {
    const raw = sessionStorage.getItem(SLOT_MASK_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SlotMask;
  } catch {
    return null;
  }
}

function resolveMask(planMask: SlotMask | null): SlotMask {
  if (planMask) return planMask;
  return readSessionMask() ?? defaultSlotMask();
}

export function GenerateButton({
  disabledReason,
  weekStart,
  planSlotMask,
}: {
  disabledReason: string | null;
  weekStart?: string;
  planSlotMask: SlotMask | null;
}) {
  const { state, startGenerate } = useGeneration();
  const [error, setError] = useState<string | null>(null);
  const pending = state.status === "running";

  async function onGenerate() {
    if (disabledReason || pending) return;
    const slotMask = resolveMask(planSlotMask);
    if (!hasAnySlot(slotMask)) {
      setError("Turn on at least one meal slot.");
      return;
    }

    setError(null);
    await startGenerate({ weekStart, slotMask });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn btn-primary"
        disabled={Boolean(disabledReason) || pending}
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
