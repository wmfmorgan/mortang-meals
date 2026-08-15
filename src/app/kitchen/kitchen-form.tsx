"use client";

import { useState, useTransition, type FormEvent } from "react";
import { KitchenChecklist } from "@/components/kitchen-checklist";
import type {
  CookingExpertise,
  InvolvedLevel,
  KitchenItem,
  KitchenPrefs,
} from "@/lib/types";
import {
  addCustomKitchenItem,
  saveKitchenPrefsAction,
  setKitchenEnabled,
} from "./actions";

const inputClass = "input";

export function KitchenForm({
  items: initialItems,
  prefs: initialPrefs,
}: {
  items: KitchenItem[];
  prefs: KitchenPrefs;
}) {
  const [items, setItems] = useState(initialItems);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<KitchenItem["kind"]>("appliance");
  const [status, setStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: string, enabled: boolean) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );
    startTransition(() => {
      void setKitchenEnabled(id, enabled);
    });
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const item = await addCustomKitchenItem(trimmed, kind);
    setItems((current) => [...current, item]);
    setName("");
  }

  async function onSavePrefs(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    const saved = await saveKitchenPrefsAction(prefs);
    setPrefs(saved);
    setStatus("Saved cook settings.");
  }

  return (
    <div className="max-w-2xl space-y-8">
      <form className="surface space-y-4 p-5" onSubmit={onSavePrefs}>
        <div>
          <h2 className="mt-0 text-xl font-medium tracking-[-0.03em]">
            How we cook
          </h2>
          <p className="mt-1 mb-0 text-sm text-herb">
            These go into every generate and swap. Leave a meal-type diet blank
            to use the overall diet.
          </p>
        </div>
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
          Overall diet style
          <input
            className={inputClass}
            value={prefs.overallDiet}
            onChange={(event) =>
              setPrefs((current) => ({
                ...current,
                overallDiet: event.target.value,
              }))
            }
            placeholder="high-protein Mediterranean"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="field">
            Breakfast diet
            <input
              className={inputClass}
              value={prefs.breakfastDiet}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  breakfastDiet: event.target.value,
                }))
              }
              placeholder="use overall"
            />
          </label>
          <label className="field">
            Lunch diet
            <input
              className={inputClass}
              value={prefs.lunchDiet}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  lunchDiet: event.target.value,
                }))
              }
              placeholder="use overall"
            />
          </label>
          <label className="field">
            Dinner diet
            <input
              className={inputClass}
              value={prefs.dinnerDiet}
              onChange={(event) =>
                setPrefs((current) => ({
                  ...current,
                  dinnerDiet: event.target.value,
                }))
              }
              placeholder="use overall"
            />
          </label>
        </div>
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
        <button type="submit" className="btn btn-primary">
          Save cook settings
        </button>
        {status ? <p className="text-sm text-herb">{status}</p> : null}
      </form>

      <KitchenChecklist items={items} onToggle={toggle} />
      <form className="surface max-w-xl space-y-4 p-5" onSubmit={onAdd}>
        <h2 className="text-xl font-medium tracking-[-0.03em]">Add custom item</h2>
        <label className="field">
          Name
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          Kind
          <select
            className={inputClass}
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as KitchenItem["kind"])
            }
          >
            <option value="appliance">appliance</option>
            <option value="method">method</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          Add
        </button>
      </form>
    </div>
  );
}
