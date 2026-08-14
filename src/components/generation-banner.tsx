"use client";

import { useEffect, useState } from "react";
import { progressForPhase } from "@/lib/generate-progress";
import { useGeneration } from "./generation-provider";

function elapsedLabel(startedAt: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function GenerationBanner() {
  const { state, cancel, dismiss } = useGeneration();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.status !== "running" || !state.startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.status, state.startedAt]);

  if (state.status === "idle") return null;

  const percent = progressForPhase(state.phase, state.attempt);
  const title =
    state.status === "running"
      ? "Generating this week"
      : state.status === "success"
        ? "Week ready"
        : "Generate failed";

  return (
    <div
      className={
        state.status === "error"
          ? "border-b border-wheat bg-alert-wash"
          : "border-b border-wheat bg-paper"
      }
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="page-eyebrow" style={{ marginBottom: 2 }}>
            {title}
            {state.status === "running" && state.startedAt
              ? ` · ${elapsedLabel(state.startedAt, now)}`
              : ""}
          </p>
          <p className="m-0 text-[0.95rem] tracking-[-0.02em]">{state.message}</p>
          <div
            className="generate-progress generate-progress-slim"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="generate-progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
        {state.status === "running" ? (
          <button type="button" className="btn btn-secondary" onClick={cancel}>
            Cancel
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={dismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
