"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mondayOf, shiftMonday } from "@/lib/week";

export function WeekSwitcher({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const thisMonday = mondayOf(new Date());
  const onCurrentWeek = weekStart === thisMonday;

  async function open(next: string) {
    setPending(true);
    try {
      const res = await fetch("/api/plans/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: next }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { plan?: { id?: string } };
      const planId = data.plan?.id;
      router.push(planId ? `/?plan=${encodeURIComponent(planId)}` : "/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-wheat/70 bg-surface-low p-1">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => void open(shiftMonday(weekStart, -1))}
        >
          Previous week
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending || onCurrentWeek}
          onClick={() => void open(thisMonday)}
        >
          Current week
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => void open(shiftMonday(weekStart, 1))}
        >
          Next week
        </button>
      </div>
    </div>
  );
}
