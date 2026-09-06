"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { shiftMonday } from "@/lib/week";

export function WeekSwitcher({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function open(next: string) {
    setPending(true);
    try {
      const res = await fetch("/api/plans/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: next }),
      });
      if (!res.ok) return;
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() => void open(shiftMonday(weekStart, -1))}
      >
        Previous week
      </button>
      <p className="m-0 font-mono text-[0.78rem] uppercase tracking-[0.12em] text-herb">
        {weekStart}
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={pending}
        onClick={() => void open(shiftMonday(weekStart, 1))}
      >
        Next week
      </button>
    </div>
  );
}
