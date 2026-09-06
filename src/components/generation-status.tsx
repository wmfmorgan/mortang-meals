"use client";

import { useEffect, useState } from "react";
import {
  elapsedLabel,
  jobTitle,
  progressForPhase,
  stepStatus,
  stepsFor,
} from "@/lib/generate-progress";
import { useGeneration } from "./generation-provider";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.2 8.2 6.4 11.4 12.8 4.6" />
    </svg>
  );
}

function Spinner() {
  return <span className="nav-job-spinner" aria-hidden="true" />;
}

export function GenerationStatus() {
  const { state, cancel, dismiss } = useGeneration();
  const [now, setNow] = useState(() => Date.now());
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (state.status !== "running" || !state.startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state.status, state.startedAt]);

  useEffect(() => {
    setHovered(false);
    setPinned(false);
  }, [state.status]);

  const open = hovered || pinned;

  if (state.status === "idle") return null;

  const kind = state.kind ?? "generate";
  const percent =
    state.status === "success"
      ? 100
      : progressForPhase(state.phase, state.attempt);
  const title = jobTitle(
    kind,
    state.status === "running"
      ? "running"
      : state.status === "success"
        ? "success"
        : "error",
  );
  const steps = stepsFor(kind);
  const chipLabel =
    state.status === "running"
      ? `${title} · ${percent}%${
          state.startedAt ? ` · ${elapsedLabel(state.startedAt, now)}` : ""
        }`
      : title;

  return (
    <div
      className="nav-job no-print"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={
          state.status === "error" ? "nav-job-chip is-error" : "nav-job-chip"
        }
        role={state.status === "error" ? "alert" : "status"}
        aria-live="polite"
      >
        <button
          type="button"
          className="nav-job-toggle"
          aria-expanded={open}
          aria-controls="nav-job-panel"
          onClick={() => setPinned((current) => !current)}
        >
          {state.status === "running" ? <Spinner /> : null}
          <span className="nav-job-label">{chipLabel}</span>
        </button>
        {state.status === "running" ? (
          <button type="button" className="btn btn-ghost nav-job-action" onClick={cancel}>
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost nav-job-action"
            onClick={dismiss}
          >
            {state.status === "success" ? "Ok" : "Dismiss"}
          </button>
        )}
      </div>
      {open ? (
        <div
          id="nav-job-panel"
          className="nav-job-panel"
          role="region"
          aria-label={title}
        >
          <div
            className={
              state.status === "error"
                ? "nav-job-panel-card is-error"
                : "nav-job-panel-card"
            }
          >
            <p className="page-eyebrow" style={{ marginBottom: 8 }}>
              {title}
              {kind !== "import" && state.attempt && state.status === "running"
                ? ` · try ${state.attempt} of 2`
                : ""}
            </p>
            <p className="nav-job-message">{state.message ?? state.error}</p>
            <div
              className="generate-progress generate-progress-slim"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="generate-progress-fill"
                style={{ width: `${percent}%` }}
              />
            </div>
            <ol className="generate-steps">
              {steps.map((step, index) => {
                const status = stepStatus(
                  index,
                  state.phase,
                  state.status,
                  kind,
                );
                return (
                  <li key={step.phase} className={`is-${status}`}>
                    {status === "done" ? (
                      <span className="generate-step-mark" aria-hidden="true">
                        <CheckIcon />
                      </span>
                    ) : (
                      <span className="generate-step-mark" aria-hidden="true" />
                    )}
                    <span>{step.label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ) : null}
    </div>
  );
}
