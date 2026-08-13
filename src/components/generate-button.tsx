"use client";

import { useState } from "react";
import type { SlotMask } from "@/lib/types";
import { hasAnySlot } from "@/lib/slot-mask";
import { useGeneration } from "./generation-provider";

export function GenerateButton({
  disabledReason,
  weekStart,
  slotMask,
}: {
  disabledReason: string | null;
  weekStart?: string;
  slotMask: SlotMask;
}) {
  const { state, startGenerate } = useGeneration();
  const [error, setError] = useState<string | null>(null);
  const pending = state.status === "running";

  async function onGenerate() {
    if (disabledReason || pending) return;
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
