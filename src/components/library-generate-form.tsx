"use client";

import { useEffect, useState } from "react";
import type { MealSlot, Person } from "@/lib/types";
import { RECIPE_SLOTS } from "@/lib/types";
import {
  DEFAULT_DESSERT_DIET,
  DESSERT_CRITERIA,
  parseDessertCriteria,
  toggleDessertCriterion,
} from "@/meals/dessert-criteria";
import { GenerationStatus } from "./generation-status";
import { useGeneration } from "./generation-provider";

type SlotFields = {
  on: boolean;
  count: number;
  diet: string;
  avoidances: string;
};

type FormState = {
  mode: "batch" | "one";
  personIds: string[];
  servings: number;
  requestText: string;
  requestSlot: MealSlot;
  breakfast: SlotFields;
  lunch: SlotFields;
  dinner: SlotFields;
  side: SlotFields;
  dessert: SlotFields;
};

const DIET_CHOICES = [
  "high-protein Mediterranean",
  "Mediterranean",
  "high-protein",
  "vegetarian",
  "vegan",
  "pescatarian",
  "keto",
  "paleo",
  "low-carb",
  "gluten-free",
] as const;

const PREFERENCE_CHIPS = [
  { label: "Quick < 20m", phrase: "under 20 minutes" },
  { label: "High protein", phrase: "high-protein" },
  { label: "Kid-approved", phrase: "kid-approved" },
] as const;

const emptySlot = (): SlotFields => ({
  on: false,
  count: 4,
  diet: "",
  avoidances: "",
});

function mergeSlot(
  current: SlotFields | undefined,
  prefs: SlotFields | undefined,
  defaults: Partial<SlotFields> = {},
): SlotFields {
  return { ...emptySlot(), ...defaults, ...current, ...prefs };
}

function clampServings(value: number): number {
  return Math.min(24, Math.max(1, value));
}

function personNotes(person: Person): string {
  const bits = [...person.allergies, ...person.avoidances]
    .map((item) => item.trim())
    .filter(Boolean);
  return bits.length > 0 ? bits.join(" · ") : "No restrictions";
}

function togglePhrase(value: string, phrase: string): string {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const key = phrase.toLowerCase();
  const exists = parts.some((part) => part.toLowerCase() === key);
  const next = exists
    ? parts.filter((part) => part.toLowerCase() !== key)
    : [...parts, phrase];
  return next.join(", ");
}

function phraseActive(value: string, phrase: string): boolean {
  const key = phrase.toLowerCase();
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .includes(key);
}

function DietField({
  slot,
  value,
  onChange,
}: {
  slot: MealSlot;
  value: string;
  onChange: (diet: string) => void;
}) {
  const inputId = `${slot}-diet`;
  const listId = `${slot}-diet-choices`;
  const dessert = slot === "dessert";
  const choices = dessert ? DESSERT_CRITERIA : DIET_CHOICES;
  const selected = dessert ? parseDessertCriteria(value) : [];
  return (
    <div className="field min-w-[10rem] flex-1">
      <label htmlFor={inputId}>{dessert ? "Criteria" : "Diet"}</label>
      <div
        className="diet-choices"
        role="group"
        aria-label={`${slot} ${dessert ? "criteria" : "diet choices"}`}
      >
        {dessert
          ? DESSERT_CRITERIA.map((choice) => (
              <button
                key={choice}
                type="button"
                className="diet-choice"
                aria-pressed={selected.includes(choice)}
                onClick={() => onChange(toggleDessertCriterion(value, choice))}
              >
                {choice}
              </button>
            ))
          : DIET_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className="diet-choice"
                aria-pressed={value === choice}
                onClick={() => onChange(choice)}
              >
                {choice}
              </button>
            ))}
      </div>
      <input
        id={inputId}
        className="input"
        value={value}
        required
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={dessert ? "low-sugar, gluten-free, dairy-free" : "or type your own"}
      />
      <datalist id={listId}>
        {choices.map((choice) => (
          <option key={choice} value={choice} />
        ))}
      </datalist>
    </div>
  );
}

function defaultForm(people: Person[]): FormState {
  return {
    mode: "batch",
    personIds: people.map((person) => person.id),
    servings: Math.max(1, people.length || 1),
    requestText: "",
    requestSlot: "dinner",
    breakfast: emptySlot(),
    lunch: emptySlot(),
    dinner: { ...emptySlot(), on: true },
    side: emptySlot(),
    dessert: { ...emptySlot(), diet: DEFAULT_DESSERT_DIET },
  };
}

export function LibraryGenerateForm({
  people,
  onStarted,
}: {
  people: Person[];
  onStarted?: () => void;
}) {
  const { startLibrary, state } = useGeneration();
  const [form, setForm] = useState<FormState>(() => defaultForm(people));
  const [activeSlot, setActiveSlot] = useState<MealSlot>("dinner");
  const pending = state.status === "running";

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/library/prefs")
      .then((res) => res.json())
      .then((data: { prefs?: Partial<FormState> | null }) => {
        if (cancelled || !data.prefs) return;
        setForm((current) => {
          const prefs = data.prefs as Partial<FormState>;
          const personIds = (prefs.personIds ?? current.personIds).filter((id) =>
            people.some((person) => person.id === id),
          );
          const servings =
            typeof prefs.servings === "number" && prefs.servings >= 1
              ? prefs.servings
              : current.servings;
          return {
            ...current,
            ...prefs,
            personIds: personIds.length > 0 ? personIds : current.personIds,
            servings,
            breakfast: mergeSlot(current.breakfast, prefs.breakfast),
            lunch: mergeSlot(current.lunch, prefs.lunch),
            dinner: mergeSlot(current.dinner, prefs.dinner, { on: true }),
            side: mergeSlot(current.side, prefs.side),
            dessert: mergeSlot(current.dessert, prefs.dessert, {
              diet: DEFAULT_DESSERT_DIET,
            }),
          };
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [people]);

  function persist(next: FormState) {
    setForm(next);
    void fetch("/api/library/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  function slotFields(slot: MealSlot): SlotFields {
    return form[slot];
  }

  function setSlot(slot: MealSlot, patch: Partial<SlotFields>) {
    persist({ ...form, [slot]: { ...form[slot], ...patch } });
  }

  function chipTarget(): string {
    if (form.mode === "one") return form.requestText;
    const slot = form[activeSlot].on
      ? activeSlot
      : (RECIPE_SLOTS.find((item) => form[item].on) ?? "dinner");
    return form[slot].diet;
  }

  function applyChip(phrase: string) {
    if (form.mode === "one") {
      persist({ ...form, requestText: togglePhrase(form.requestText, phrase) });
      return;
    }
    const slot = form[activeSlot].on
      ? activeSlot
      : (RECIPE_SLOTS.find((item) => form[item].on) ?? "dinner");
    setSlot(slot, { diet: togglePhrase(form[slot].diet, phrase) });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body: Record<string, unknown> = {
      personIds: form.personIds,
      servings: form.servings,
    };
    if (form.mode === "one") {
      const fields = slotFields(form.requestSlot);
      body.request = {
        slot: form.requestSlot,
        text: form.requestText.trim(),
        diet: fields.diet.trim(),
        avoidances: fields.avoidances,
      };
    } else {
      for (const slot of RECIPE_SLOTS) {
        const fields = slotFields(slot);
        if (!fields.on) continue;
        body[slot] = {
          count: fields.count,
          diet: fields.diet.trim(),
          avoidances: fields.avoidances,
        };
      }
    }
    void startLibrary(body);
    onStarted?.();
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
      <p className="mt-0 text-sm text-herb">
        Drafts land in a queue below. Approve to keep them; reject to delete.
        Diet and avoidances here apply only to this run.
      </p>
      <div className="meal-extra-toggle" role="group" aria-label="Generate mode">
        <button
          type="button"
          className="meal-extra-mode"
          aria-pressed={form.mode === "batch"}
          onClick={() => persist({ ...form, mode: "batch" })}
        >
          Batch
        </button>
        <button
          type="button"
          className="meal-extra-mode"
          aria-pressed={form.mode === "one"}
          onClick={() => persist({ ...form, mode: "one" })}
        >
          One recipe
        </button>
      </div>

      <fieldset className="space-y-2">
        <legend className="page-eyebrow" style={{ margin: 0 }}>
          People
        </legend>
        {people.length === 0 ? (
          <p className="m-0 text-sm text-herb">Add people on Household first.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  persist({
                    ...form,
                    personIds: people.map((person) => person.id),
                  })
                }
              >
                Select all
              </button>
            </div>
            <div className="library-people-cards">
              {people.map((person) => (
                <label key={person.id} className="library-person-card">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.personIds.includes(person.id)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...form.personIds, person.id]
                        : form.personIds.filter((id) => id !== person.id);
                      persist({ ...form, personIds: next });
                    }}
                  />
                  <span className="library-person-card-name">{person.name}</span>
                  <span className="library-person-card-notes">
                    {personNotes(person)}
                  </span>
                </label>
              ))}
            </div>
            <div className="library-stepper">
              <span className="text-sm">Servings Override</span>
              <div className="library-stepper-controls">
                <button
                  type="button"
                  aria-label="Decrease servings"
                  disabled={form.servings <= 1}
                  onClick={() =>
                    persist({
                      ...form,
                      servings: clampServings(form.servings - 1),
                    })
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={24}
                  aria-label="Servings Override"
                  value={form.servings}
                  onChange={(event) =>
                    persist({
                      ...form,
                      servings: clampServings(Number(event.target.value) || 1),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Increase servings"
                  disabled={form.servings >= 24}
                  onClick={() =>
                    persist({
                      ...form,
                      servings: clampServings(form.servings + 1),
                    })
                  }
                >
                  +
                </button>
              </div>
            </div>
          </>
        )}
      </fieldset>

      {form.mode === "one" ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="field min-w-[16rem] flex-1">
            I need a recipe for
            <input
              className="input"
              value={form.requestText}
              onChange={(event) =>
                persist({ ...form, requestText: event.target.value })
              }
              placeholder="spaghetti sauce"
              required
            />
          </label>
          <label className="field">
            Type
            <select
              className="input"
              value={form.requestSlot}
              onChange={(event) => {
                const requestSlot = event.target.value as MealSlot;
                setActiveSlot(requestSlot);
                persist({ ...form, requestSlot });
              }}
            >
              {RECIPE_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="library-chips" role="group" aria-label="Preference chips">
        {PREFERENCE_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="library-chip"
            aria-pressed={phraseActive(chipTarget(), chip.phrase)}
            onClick={() => applyChip(chip.phrase)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {(form.mode === "batch" ? RECIPE_SLOTS : [form.requestSlot]).map((slot) => {
        const fields = slotFields(slot);
        return (
          <fieldset key={slot} className="space-y-2 rounded-xl border border-wheat p-3">
            {form.mode === "batch" ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={fields.on}
                  onChange={(event) => {
                    setActiveSlot(slot);
                    setSlot(slot, { on: event.target.checked });
                  }}
                />
                {slot}
              </label>
            ) : (
              <p className="page-eyebrow" style={{ margin: 0 }}>
                {slot}
              </p>
            )}
            {form.mode === "one" || fields.on ? (
              <div className="space-y-2">
                <DietField
                  slot={slot}
                  value={fields.diet}
                  onChange={(diet) => {
                    setActiveSlot(slot);
                    setSlot(slot, { diet });
                  }}
                />
                <div className="flex flex-wrap items-end gap-2">
                  {form.mode === "batch" ? (
                    <label className="field" style={{ width: "5.5rem" }}>
                      Count
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={12}
                        value={fields.count}
                        onChange={(event) =>
                          setSlot(slot, { count: Number(event.target.value) || 1 })
                        }
                      />
                    </label>
                  ) : null}
                  <label className="field min-w-[10rem] flex-1">
                    Extra avoidances
                    <input
                      className="input"
                      value={fields.avoidances}
                      onChange={(event) =>
                        setSlot(slot, { avoidances: event.target.value })
                      }
                      placeholder="pork, cilantro"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </fieldset>
        );
      })}

      <div className="library-generate-actions">
        <button
          type="submit"
          className="btn btn-primary library-pill"
          disabled={
            pending ||
            people.length === 0 ||
            form.personIds.length === 0 ||
            (form.mode === "one"
              ? !form.requestText.trim()
              : !RECIPE_SLOTS.some((slot) => form[slot].on))
          }
        >
          {pending && state.kind === "library"
            ? "Generating…"
            : "Generate Recipes with AI"}
        </button>
        <GenerationStatus variant="inline" />
      </div>
    </form>
  );
}
