"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  HouseholdFields,
  emptyPerson,
  householdToDraft,
  type HouseholdDraft,
} from "@/components/household-fields";
import { KitchenChecklist } from "@/components/kitchen-checklist";
import type {
  CookingExpertise,
  Household,
  InvolvedLevel,
  KitchenItem,
  KitchenPrefs,
} from "@/lib/types";
import { saveHouseholdAction } from "./actions";
import {
  addCustomKitchenItem,
  saveKitchenPrefsAction,
  setKitchenEnabled,
} from "@/app/kitchen/actions";

const inputClass = "input";

export function HouseholdKitchenForm({
  household,
  items: initialItems,
  prefs: initialPrefs,
}: {
  household: Household | null;
  items: KitchenItem[];
  prefs: KitchenPrefs;
}) {
  const [draft, setDraft] = useState<HouseholdDraft>(() =>
    householdToDraft(household),
  );
  const [items, setItems] = useState(initialItems);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [customName, setCustomName] = useState("");
  const [customKind, setCustomKind] = useState<KitchenItem["kind"]>("appliance");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  const enabledCount = items.filter((item) => item.enabled).length;

  function toggle(id: string, enabled: boolean) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );
    startTransition(() => {
      void setKitchenEnabled(id, enabled);
    });
  }

  async function onAddCustom() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const item = await addCustomKitchenItem(trimmed, customKind);
    setItems((current) => [...current, item]);
    setCustomName("");
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    setError(null);
    setPending(true);
    try {
      await saveHouseholdAction({
        name: draft.name,
        dietStyle: "",
        notes: draft.notes,
        servings: "",
        people: draft.people.map((person) => ({
          name: person.name,
          age: person.age,
          sex: person.sex,
          allergies: person.allergies,
          avoidances: person.avoidances,
        })),
      });
      const savedPrefs = await saveKitchenPrefsAction({
        ...prefs,
        overallDiet: "",
        breakfastDiet: "",
        lunchDiet: "",
        dinnerDiet: "",
      });
      setPrefs(savedPrefs);
      setStatus("Saved.");
    } catch {
      setError("Couldn’t save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mx-auto max-w-3xl space-y-6" onSubmit={onSave}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              people: [...current.people, emptyPerson()],
            }))
          }
        >
          Add person
        </button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
      {status ? <p className="m-0 text-sm text-herb">{status}</p> : null}
      {error ? (
        <p role="alert" className="alert m-0">
          {error}
        </p>
      ) : null}

      <section className="surface space-y-5 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-xl font-medium tracking-[-0.03em]">
              Household Kitchen Profile
            </h2>
            <span className="rounded-full bg-wheat/60 px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-herb">
              All-household rules
            </span>
          </div>
          <p className="mt-1 mb-0 text-sm text-herb">
            How you cook and which appliances library generate may use. Diet
            styles live on Meals.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="field">
            Cooking expertise
            <select
              className={inputClass}
              value={prefs.expertise}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  expertise: event.target.value as CookingExpertise,
                }))
              }
            >
              <option value="newbie">newbie</option>
              <option value="novice">novice</option>
              <option value="intermediate">intermediate</option>
              <option value="expert">expert</option>
            </select>
          </label>
          <label className="field">
            How involved
            <select
              className={inputClass}
              value={prefs.involved}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  involved: event.target.value as InvolvedLevel,
                }))
              }
            >
              <option value="low">low — few ingredients, one vessel</option>
              <option value="medium">medium — a normal weeknight</option>
              <option value="high">high — more components and steps</option>
            </select>
          </label>
          <label className="field">
            Max cook time (minutes)
            <input
              className={inputClass}
              type="number"
              min={5}
              step={5}
              value={prefs.maxCookMinutes}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  maxCookMinutes: Number(event.target.value) || 5,
                }))
              }
            />
          </label>
        </div>

        <div className="space-y-3 border-t border-wheat/70 pt-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="m-0 text-base font-medium tracking-[-0.02em]">
                Cooking methods &amp; kitchen equipment
              </h3>
              <p className="mt-1 mb-0 text-sm text-herb">
                {enabledCount} active. Library generate only uses items that are
                on.
              </p>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="alert">
              No kitchen items yet. Refresh this page to load the defaults, or
              add a custom item below.
            </p>
          ) : (
            <KitchenChecklist items={items} onToggle={toggle} />
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
            <label className="field">
              Custom item
              <input
                className={inputClass}
                value={customName}
                placeholder="e.g. sous vide"
                onChange={(event) => setCustomName(event.target.value)}
              />
            </label>
            <label className="field">
              Kind
              <select
                className={inputClass}
                value={customKind}
                onChange={(event) =>
                  setCustomKind(event.target.value as KitchenItem["kind"])
                }
              >
                <option value="appliance">appliance</option>
                <option value="method">method</option>
              </select>
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void onAddCustom();
              }}
            >
              Add
            </button>
          </div>
        </div>
      </section>

      <section className="surface space-y-4 p-5">
        <div>
          <h2 className="m-0 text-xl font-medium tracking-[-0.03em]">
            Household &amp; people
          </h2>
          <p className="mt-1 mb-0 text-sm text-herb">
            Who you cook for: names, allergies, avoidances, and notes.
          </p>
        </div>
        <HouseholdFields
          value={draft}
          onChange={setDraft}
          showAddPerson={false}
        />
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
