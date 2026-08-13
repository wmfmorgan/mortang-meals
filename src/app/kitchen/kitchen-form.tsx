"use client";

import { useState, useTransition, type FormEvent } from "react";
import { KitchenChecklist } from "@/components/kitchen-checklist";
import type { KitchenItem } from "@/lib/types";
import { addCustomKitchenItem, setKitchenEnabled } from "./actions";

const inputClass =
  "mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1";

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
    <div className="max-w-xl space-y-6">
      <KitchenChecklist items={items} onToggle={toggle} />
      <form className="space-y-3" onSubmit={onAdd}>
        <h2 className="text-lg font-medium">Add custom item</h2>
        <label className="block text-sm font-medium">
          Name
          <input
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium">
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
          className="rounded border border-zinc-400 bg-white px-3 py-1"
        >
          Add
        </button>
      </form>
    </div>
  );
}
