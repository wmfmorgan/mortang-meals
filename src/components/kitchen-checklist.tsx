"use client";

import type { KitchenItem } from "@/lib/types";

export function KitchenChecklist({
  items,
  onToggle,
}: {
  items: KitchenItem[];
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <label className="flex items-center gap-2">
            <input
              className="h-4 w-4"
              type="checkbox"
              checked={item.enabled}
              onChange={(event) => onToggle(item.id, event.target.checked)}
            />
            <span>
              {item.name}{" "}
              <span className="text-zinc-500">({item.kind})</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
