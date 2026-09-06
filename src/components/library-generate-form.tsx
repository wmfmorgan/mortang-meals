"use client";

import { useEffect, useState } from "react";
import type { Person, WeekSlot } from "@/lib/types";
import { SLOTS } from "@/lib/types";
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
  requestText: string;
  requestSlot: WeekSlot;
  breakfast: SlotFields;
  lunch: SlotFields;
  dinner: SlotFields;
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

const emptySlot = (): SlotFields => ({
  on: false,
  count: 4,
  diet: "",
  avoidances: "",
});

function DietField({
  slot,
  value,
  onChange,
}: {
  slot: WeekSlot;
  value: string;
  onChange: (diet: string) => void;
}) {
  const inputId = `${slot}-diet`;
  const listId = `${slot}-diet-choices`;
  return (
    <div className="field min-w-[10rem] flex-1">
      <label htmlFor={inputId}>Diet</label>
      <div className="diet-choices" role="group" aria-label={`${slot} diet choices`}>
        {DIET_CHOICES.map((choice) => (
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
        placeholder="or type your own"
      />
      <datalist id={listId}>
        {DIET_CHOICES.map((choice) => (
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
    requestText: "",
    requestSlot: "dinner",
    breakfast: emptySlot(),
    lunch: emptySlot(),
    dinner: { ...emptySlot(), on: true },
  };
}

export function LibraryGenerateForm({ people }: { people: Person[] }) {
  const { startLibrary, state } = useGeneration();
  const [form, setForm] = useState<FormState>(() => defaultForm(people));
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
          return {
            ...current,
            ...prefs,
            personIds: personIds.length > 0 ? personIds : current.personIds,
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

  function slotFields(slot: WeekSlot): SlotFields {
    return form[slot];
  }

  function setSlot(slot: WeekSlot, patch: Partial<SlotFields>) {
    persist({ ...form, [slot]: { ...form[slot], ...patch } });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body: Record<string, unknown> = { personIds: form.personIds };
    if (form.mode === "one") {
      const fields = slotFields(form.requestSlot);
      body.request = {
        slot: form.requestSlot,
        text: form.requestText.trim(),
        diet: fields.diet.trim(),
        avoidances: fields.avoidances,
      };
    } else {
      for (const slot of SLOTS) {
        const fields = slotFields(slot);
        if (!fields.on) continue;
        body[slot] = {
          count: fields.count,
          diet: fields.diet.trim(),
          avoidances: fields.avoidances,
        };
      }
    }
    await startLibrary(body);
  }

  return (
    <form className="surface space-y-4 p-5" onSubmit={(event) => void onSubmit(event)}>
      <h2 className="mt-0 mb-1 text-xl font-medium tracking-[-0.03em]">
        Generate library
      </h2>
      <p className="mt-0 text-sm text-herb">
        Drafts land in a queue below. Approve to keep them; reject to delete.
        Diet and avoidances here override Household and Kitchen for this run.
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
          <div className="flex flex-wrap gap-3">
            {people.map((person) => (
              <label key={person.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.personIds.includes(person.id)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...form.personIds, person.id]
                      : form.personIds.filter((id) => id !== person.id);
                    persist({ ...form, personIds: next });
                  }}
                />
                {person.name}
              </label>
            ))}
          </div>
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
            Meal
            <select
              className="input"
              value={form.requestSlot}
              onChange={(event) =>
                persist({
                  ...form,
                  requestSlot: event.target.value as WeekSlot,
                })
              }
            >
              {SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {(form.mode === "batch" ? SLOTS : [form.requestSlot]).map((slot) => {
        const fields = slotFields(slot);
        return (
          <fieldset key={slot} className="space-y-2 rounded-xl border border-wheat p-3">
            {form.mode === "batch" ? (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={fields.on}
                  onChange={(event) => setSlot(slot, { on: event.target.checked })}
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
                  onChange={(diet) => setSlot(slot, { diet })}
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

      <button
        type="submit"
        className="btn btn-primary"
        disabled={
          pending ||
          people.length === 0 ||
          form.personIds.length === 0 ||
          (form.mode === "one"
            ? !form.requestText.trim()
            : !SLOTS.some((slot) => form[slot].on))
        }
      >
        {pending && state.kind === "library" ? "Generating…" : "Generate drafts"}
      </button>
    </form>
  );
}
