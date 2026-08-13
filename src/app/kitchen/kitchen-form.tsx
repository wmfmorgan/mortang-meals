"use client";

import { useState, useTransition, type FormEvent } from "react";
import { KitchenChecklist } from "@/components/kitchen-checklist";
import type { KitchenItem } from "@/lib/types";
import { addCustomKitchenItem, setKitchenEnabled } from "./actions";

const inputClass = "input";

export function KitchenForm({ items: initialItems }: { items: KitchenItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<KitchenItem["kind"]>("appliance");
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

  return (
    <div className="max-w-2xl space-y-8">
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
        <button
          type="submit"
          className="btn btn-primary"
        >
          Add
        </button>
      </form>
    </div>
  );
}
