"use client";

import { useEffect, useState } from "react";
import {
  GENERATE_STEPS,
  activeStepIndex,
  progressForPhase,
} from "@/lib/generate-progress";
import { useGeneration } from "./generation-provider";

function elapsedLabel(startedAt: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function GenerationModal() {
  const { state, cancel, dismiss } = useGeneration();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.status !== "running" || !state.startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.status, state.startedAt]);

  if (state.status === "idle") return null;

  const percent = progressForPhase(state.phase, state.attempt);
  const stepIndex = activeStepIndex(state.phase);
  const title =
    state.status === "running"
      ? "Generating this week"
      : state.status === "success"
        ? "Week ready"
        : "Generate failed";

  return (
    <div className="generate-modal-root">
      <div className="generate-modal-backdrop" />
      <div
        className="generate-modal"
        role={state.status === "error" ? "alert" : "dialog"}
        aria-modal="true"
        aria-labelledby="generate-modal-title"
        aria-live="polite"
      >
        <p className="page-eyebrow" style={{ marginBottom: 8 }}>
          {title}
          {state.status === "running" && state.startedAt
            ? ` · ${elapsedLabel(state.startedAt, now)}`
            : ""}
          {state.attempt && state.status === "running"
            ? ` · try ${state.attempt} of 2`
            : ""}
        </p>
        <h2 id="generate-modal-title" className="generate-modal-title">
          {state.message}
        </h2>

        <div
          className="generate-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="generate-progress-fill" style={{ width: `${percent}%` }} />
        </div>

        <ol className="generate-steps">
          {GENERATE_STEPS.map((step, index) => (
            <li
              key={step.phase}
              className={
                index < stepIndex
                  ? "is-done"
                  : index === stepIndex
                    ? "is-current"
                    : undefined
              }
            >
              {step.label}
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap gap-2">
          {state.status === "running" ? (
            <button type="button" className="btn btn-secondary" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={dismiss}>
              {state.status === "success" ? "Ok" : "Dismiss"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
