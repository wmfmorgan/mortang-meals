"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Meal, Person } from "@/lib/types";
import { stepChipTitle } from "@/lib/step-title";
import { cookAllergenRibbon } from "@/meals/cook-allergen";
import { scaleIngredients } from "@/meals/scale-servings";
import { MealBadges } from "./meal-card";
import { MealImage } from "./meal-image";
import { SourceLink } from "./recipe-flyout";
import { StarRating } from "./star-rating";

const CHECKS_PREFIX = "mortang.cookChecks.";
const STEP_PREFIX = "mortang.cookStep.";
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 24;

function checksKey(mealId: string) {
  return `${CHECKS_PREFIX}${mealId}`;
}

function stepKey(mealId: string) {
  return `${STEP_PREFIX}${mealId}`;
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode / SSR */
  }
}

function emptyChecks(total: number): boolean[] {
  return Array.from({ length: total }, () => false);
}

function readChecks(mealId: string, total: number): boolean[] {
  const next = emptyChecks(total);
  const raw = readSession(checksKey(mealId));
  if (!raw) return next;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return next;
    for (const item of parsed) {
      if (typeof item === "number" && Number.isInteger(item) && item >= 0 && item < total) {
        next[item] = true;
      }
    }
    return next;
  } catch {
    return next;
  }
}

function writeChecks(mealId: string, flags: boolean[]) {
  const indexes = flags.flatMap((on, index) => (on ? [index] : []));
  writeSession(checksKey(mealId), JSON.stringify(indexes));
}

function readStep(mealId: string, total: number): number {
  if (total <= 0) return 0;
  const raw = readSession(stepKey(mealId));
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const index = typeof parsed === "number" ? parsed : Number(parsed);
    if (!Number.isInteger(index) || index < 0 || index >= total) return 0;
    return index;
  } catch {
    return 0;
  }
}

function writeStep(mealId: string, index: number) {
  writeSession(stepKey(mealId), JSON.stringify(index));
}

function clampServings(value: number): number {
  if (!Number.isFinite(value)) return MIN_SERVINGS;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(value)));
}

function secondsFromCookMinutes(cookMinutes: number): number {
  if (!Number.isFinite(cookMinutes) || cookMinutes <= 0) return 0;
  return Math.round(cookMinutes) * 60;
}

function formatMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getWakeLock(): WakeLock | undefined {
  if (typeof navigator === "undefined") return undefined;
  return "wakeLock" in navigator ? navigator.wakeLock : undefined;
}

function ingredientLabel(item: { quantity: string; unit: string; name: string }): string {
  return `${item.quantity} ${item.unit} ${item.name}`.replace(/\s+/g, " ").trim();
}

export function CookMode({
  meal,
  people,
  servingsLabel,
  canSwap,
  actions,
  onRate,
}: {
  meal: Meal;
  people: Person[];
  servingsLabel?: string;
  canSwap: boolean;
  actions: ReactNode;
  onRate?: (stars: number) => void;
}) {
  void canSwap;
  void servingsLabel;

  const [checked, setChecked] = useState(() => emptyChecks(meal.ingredients.length));
  const [activeStep, setActiveStep] = useState(0);
  const [displayServings, setDisplayServings] = useState(() =>
    clampServings(meal.servings || 1),
  );
  const [wakeSupported, setWakeSupported] = useState(false);
  const [wakeHeld, setWakeHeld] = useState(false);
  const [remaining, setRemaining] = useState(() =>
    secondsFromCookMinutes(meal.cookMinutes),
  );
  const [running, setRunning] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const wantWakeRef = useRef(false);
  const requestGenRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    setChecked(readChecks(meal.id, meal.ingredients.length));
    setActiveStep(readStep(meal.id, meal.steps.length));
    setDisplayServings(clampServings(meal.servings || 1));
    setRemaining(secondsFromCookMinutes(meal.cookMinutes));
    setRunning(false);
  }, [
    meal.id,
    meal.ingredients.length,
    meal.steps.length,
    meal.servings,
    meal.cookMinutes,
  ]);

  async function releaseSentinel(sentinel: WakeLockSentinel | null) {
    if (!sentinel) return;
    try {
      await sentinel.release();
    } catch {
      /* ignore */
    }
  }

  async function acquireWakeLock() {
    const api = getWakeLock();
    if (!api) return;
    wantWakeRef.current = true;
    const gen = ++requestGenRef.current;
    try {
      const sentinel = await api.request("screen");
      if (
        gen !== requestGenRef.current ||
        !wantWakeRef.current ||
        !mountedRef.current
      ) {
        await releaseSentinel(sentinel);
        return;
      }
      const previous = sentinelRef.current;
      sentinelRef.current = sentinel;
      setWakeHeld(true);
      if (previous && previous !== sentinel) await releaseSentinel(previous);
    } catch {
      if (gen !== requestGenRef.current) return;
      sentinelRef.current = null;
      setWakeHeld(false);
      wantWakeRef.current = false;
    }
  }

  async function dropWakeLock() {
    requestGenRef.current += 1;
    wantWakeRef.current = false;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    setWakeHeld(false);
    await releaseSentinel(sentinel);
  }

  useEffect(() => {
    mountedRef.current = true;
    const api = getWakeLock();
    if (!api) return;

    setWakeSupported(true);
    void acquireWakeLock();

    function onVisibility() {
      if (document.visibilityState === "visible" && wantWakeRef.current) {
        void acquireWakeLock();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      void dropWakeLock();
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining <= 0) setRunning(false);
  }, [remaining]);

  const scaled = useMemo(
    () => scaleIngredients(meal.ingredients, meal.servings, displayServings),
    [meal.ingredients, meal.servings, displayServings],
  );
  const ribbon = useMemo(
    () => cookAllergenRibbon(people, meal.ingredients),
    [people, meal.ingredients],
  );

  const checkedCount = checked.filter(Boolean).length;
  const stepCount = meal.steps.length;
  const hasSteps = stepCount > 0;
  const lastIndex = stepCount - 1;
  const current = hasSteps ? Math.min(activeStep, lastIndex) : 0;
  const currentStep = hasSteps ? meal.steps[current] ?? "" : "";

  function toggleCheck(index: number) {
    setChecked((prev) => {
      const flags =
        prev.length === meal.ingredients.length
          ? prev
          : emptyChecks(meal.ingredients.length);
      const next = flags.map((on, i) => (i === index ? !on : on));
      writeChecks(meal.id, next);
      return next;
    });
  }

  function goToStep(index: number) {
    if (!hasSteps) return;
    const next = Math.min(Math.max(0, index), lastIndex);
    setActiveStep(next);
    writeStep(meal.id, next);
  }

  function toggleWake() {
    if (!wakeSupported) return;
    if (wakeHeld) {
      void dropWakeLock();
      return;
    }
    void acquireWakeLock();
  }

  function toggleTimer() {
    if (remaining <= 0) return;
    setRunning((on) => !on);
  }

  function resetTimer() {
    setRunning(false);
    setRemaining(secondsFromCookMinutes(meal.cookMinutes));
  }

  return (
    <div className="cook-mode">
      <header className="cook-header">
        <div className="cook-header-bar no-print">
          <Link href="/meals" className="cook-exit no-print">
            Exit to Library
          </Link>
          <div className="cook-header-actions">{actions}</div>
        </div>
        <div className="cook-header-title">
          <h1 className="cook-title">
            <MealBadges meal={meal} />
            {meal.title}
          </h1>
          {!meal.draft ? (
            <StarRating value={meal.stars} onChange={onRate} />
          ) : null}
        </div>
        <p className="cook-meta">
          {meal.cookMinutes} min · Feeds {displayServings} · {meal.method}
        </p>
        {meal.sourceUrl ? <SourceLink href={meal.sourceUrl} /> : null}
        <div className="cook-utils no-print">
          <button
            type="button"
            className="cook-pill cook-wake"
            aria-pressed={wakeHeld}
            title={
              wakeSupported ? undefined : "Not supported on this browser"
            }
            onClick={toggleWake}
          >
            Screen Awake
          </button>
          <div className="cook-pill">
            <span className="cook-pill-label">Servings</span>
            <button
              type="button"
              className="cook-stepper-btn"
              aria-label="Decrease servings"
              disabled={displayServings <= MIN_SERVINGS}
              onClick={() => setDisplayServings((n) => clampServings(n - 1))}
            >
              −
            </button>
            <span className="cook-stepper-value" aria-live="polite">
              {displayServings}
            </span>
            <button
              type="button"
              className="cook-stepper-btn"
              aria-label="Increase servings"
              disabled={displayServings >= MAX_SERVINGS}
              onClick={() => setDisplayServings((n) => clampServings(n + 1))}
            >
              +
            </button>
          </div>
          <div className="cook-pill">
            <span className="cook-pill-label">Timer</span>
            <span
              className="cook-timer-value"
              role="timer"
              aria-label="Cook timer"
            >
              {formatMmSs(remaining)}
            </span>
            <button
              type="button"
              className="cook-timer-btn"
              disabled={remaining <= 0}
              onClick={toggleTimer}
            >
              {running ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="cook-timer-btn"
              onClick={resetTimer}
            >
              Reset
            </button>
          </div>
        </div>
        <p className="cook-ribbon" data-tone={ribbon.tone} role="status">
          {ribbon.text}
        </p>
      </header>

      <div className="cook-split">
        <aside className="cook-card no-print">
          <div className="cook-mise-head">
            <h2 className="cook-card-title">Mise en Place</h2>
            <span className="cook-ready">
              {checkedCount} of {meal.ingredients.length} Ready
            </span>
          </div>
          <ul className="cook-ings">
            {scaled.map((item, index) => (
              <li key={`${index}-${item.name}`}>
                <label
                  className="cook-ing"
                  data-checked={checked[index] ? "true" : "false"}
                >
                  <input
                    type="checkbox"
                    className="shop-check"
                    checked={Boolean(checked[index])}
                    onChange={() => toggleCheck(index)}
                  />
                  <span>{ingredientLabel(item)}</span>
                </label>
              </li>
            ))}
          </ul>
          {meal.method ? (
            <div className="cook-equipment">
              <h3 className="cook-equipment-title">Equipment</h3>
              <span className="cook-chip">{meal.method}</span>
            </div>
          ) : null}
        </aside>

        <section className="cook-stage">
          {hasSteps ? (
            <>
              <nav className="cook-card cook-steps-card no-print" aria-label="Cooking steps">
                <div className="cook-steps">
                  {meal.steps.map((step, index) => (
                    <button
                      key={`${index}-${step}`}
                      type="button"
                      className="cook-step-chip"
                      aria-current={index === current ? "step" : undefined}
                      data-done={index < current ? "true" : undefined}
                      onClick={() => goToStep(index)}
                    >
                      {stepChipTitle(step, index)}
                    </button>
                  ))}
                </div>
              </nav>
              <article className="cook-card cook-stage-card no-print">
                <p className="cook-stage-kicker">
                  Step {current + 1} of {stepCount}
                </p>
                <h2 className="cook-stage-heading">
                  {stepChipTitle(currentStep, current)}
                </h2>
                <div className="cook-stage-image no-print">
                  <MealImage imageUrl={meal.imageUrl} />
                </div>
                <p className="cook-instruction">{currentStep}</p>
                <div className="cook-stage-nav no-print">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={current === 0}
                    onClick={() => goToStep(current - 1)}
                  >
                    {current === 0 ? "Previous" : `Step ${current}`}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={current >= lastIndex}
                    onClick={() => goToStep(current + 1)}
                  >
                    {current >= lastIndex
                      ? "Next"
                      : `Next: ${stepChipTitle(meal.steps[current + 1] ?? "", current + 1)}`}
                  </button>
                </div>
              </article>
            </>
          ) : (
            <div className="cook-card cook-stage-card no-print">
              <p className="cook-instruction">No method steps yet.</p>
              <div className="cook-stage-image no-print">
                <MealImage imageUrl={meal.imageUrl} />
              </div>
            </div>
          )}
          {meal.whyItFits ? (
            <aside
              className="cook-card cook-pro-tip"
              role="region"
              aria-label="Counter Pro-Tip"
            >
              <h2 className="cook-card-title">Counter Pro-Tip</h2>
              <p>{meal.whyItFits}</p>
            </aside>
          ) : null}
        </section>
      </div>

      <section className="cook-print-only">
        <ul>
          {scaled.map((item, index) => (
            <li key={`print-ing-${index}-${item.name}`}>
              {ingredientLabel(item)}
            </li>
          ))}
        </ul>
        <ol aria-label="Full method">
          {meal.steps.map((step, index) => (
            <li key={`print-step-${index}`}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
