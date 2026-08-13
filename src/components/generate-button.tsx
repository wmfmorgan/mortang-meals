"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";

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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    if (disabledReason) return;
    const slotMask = resolveMask(planSlotMask);
    if (!hasAnySlot(slotMask)) {
      setError("Turn on at least one meal slot.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(weekStart ? { weekStart } : {}),
          slotMask,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "Couldn’t get a usable plan, try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("The model didn’t respond");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="rounded border border-zinc-400 bg-white px-3 py-1 disabled:opacity-50"
        disabled={Boolean(disabledReason) || pending}
        onClick={() => {
          void onGenerate();
        }}
      >
        {pending ? "Generating…" : "Generate"}
      </button>
      {error ? (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
