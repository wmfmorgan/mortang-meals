"use client";

import { useEffect, useState } from "react";
import type { MealSlot, Person } from "@/lib/types";
import { RECIPE_SLOTS } from "@/lib/types";
import { useGeneration } from "./generation-provider";
import { LibraryGenerateForm } from "./library-generate-form";
import { LEAVE_RECIPE_MESSAGE, MealDetail } from "./meal-detail";

type ModalView = "chooser" | "ai" | "manual";

function uniqueAllergies(people: Person[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const person of people) {
    for (const allergy of person.allergies) {
      const trimmed = allergy.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(trimmed);
    }
  }
  return names;
}

export function AddRecipeModal({
  people,
  servings,
  onClose,
}: {
  people: Person[];
  servings: number;
  onClose: () => void;
}) {
  const { startImport } = useGeneration();
  const [view, setView] = useState<ModalView>("chooser");
  const [url, setUrl] = useState("");
  const [importSlot, setImportSlot] = useState<MealSlot>("dinner");
  const [manualDirty, setManualDirty] = useState(false);
  const allergies = uniqueAllergies(people);

  function confirmLeaveManual(): boolean {
    if (view !== "manual" || !manualDirty) return true;
    return window.confirm(LEAVE_RECIPE_MESSAGE);
  }

  function requestClose() {
    if (!confirmLeaveManual()) return;
    onClose();
  }

  function requestBack() {
    if (!confirmLeaveManual()) return;
    setView("chooser");
    setManualDirty(false);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, view, manualDirty]);

  function onImport(event: React.FormEvent) {
    event.preventDefault();
    const next = url.trim();
    if (!next) return;
    void startImport({ url: next, slot: importSlot });
    onClose();
  }

  const title =
    view === "ai"
      ? "Create with AI Chef"
      : view === "manual"
        ? "Add Recipe Manually"
        : "Add New Recipe";

  return (
    <>
      <button
        type="button"
        className="library-modal-backdrop"
        aria-label="Close"
        onClick={requestClose}
      />
      <div
        className="library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-recipe-title"
      >
        <div className="library-modal-header">
          <div>
            {view !== "chooser" ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={requestBack}
              >
                Back to options
              </button>
            ) : null}
            <h2 id="add-recipe-title" className="library-modal-title">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close modal"
            title="Close modal"
            onClick={requestClose}
          >
            <CloseIcon />
          </button>
        </div>

        {view === "chooser" ? (
          <div className="library-modal-options">
            <section className="library-modal-option">
              <div>
                <h3 className="library-modal-option-title">Import from URL</h3>
                <p className="library-modal-option-copy">
                  Paste a recipe URL. The page is read and saved with a link
                  back to the source.
                </p>
              </div>
              <form className="library-modal-import" onSubmit={onImport}>
                <label className="field min-w-[12rem] flex-1">
                  Recipe URL
                  <input
                    className="input"
                    type="url"
                    required
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://"
                  />
                </label>
                <label className="field">
                  Meal
                  <select
                    className="input"
                    value={importSlot}
                    onChange={(event) =>
                      setImportSlot(event.target.value as MealSlot)
                    }
                  >
                    {RECIPE_SLOTS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn-primary library-pill">
                  Import
                </button>
              </form>
            </section>

            <section className="library-modal-option">
              <div>
                <h3 className="library-modal-option-title">Create with AI Chef</h3>
                <p className="library-modal-option-copy">
                  Draft recipes for selected people. Diet and avoidances apply
                  only to this run.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary library-pill"
                onClick={() => setView("ai")}
              >
                Generate
              </button>
            </section>

            <section className="library-modal-option">
              <div>
                <h3 className="library-modal-option-title">
                  Manual Recipe Entry
                </h3>
                <p className="library-modal-option-copy">
                  Type your own recipe with ingredients, timing, and steps.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary library-pill"
                onClick={() => setView("manual")}
              >
                Start Blank
              </button>
            </section>

            {allergies.length > 0 ? (
              <p className="library-safety-note">
                Recipes are checked against household allergies:{" "}
                {allergies.join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}

        {view === "ai" ? (
          <LibraryGenerateForm people={people} onStarted={onClose} />
        ) : null}

        {view === "manual" ? (
          <MealDetail
            mode="create"
            servings={`Serves ${servings}`}
            canSwap={false}
            onSaved={() => {}}
            onClose={onClose}
            onDirtyChange={setManualDirty}
          />
        ) : null}
      </div>
    </>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}
