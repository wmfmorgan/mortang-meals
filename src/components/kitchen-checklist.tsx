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
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id}>
          <label
            className={
              item.enabled
                ? "surface flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2.5"
                : "flex min-h-11 cursor-pointer items-center gap-3 rounded-[1.15rem] border border-dashed border-wheat px-3 py-2.5"
            }
          >
            <input
              className="h-4 w-4 accent-[var(--color-olive)]"
              type="checkbox"
              checked={item.enabled}
              onChange={(event) => onToggle(item.id, event.target.checked)}
            />
            <span>
              {item.name}{" "}
              <span className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-herb">
                {item.kind}
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
