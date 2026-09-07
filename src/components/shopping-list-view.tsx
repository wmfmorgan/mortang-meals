"use client";

import { useEffect, useMemo, useState } from "react";
import type { Aisle, ShoppingList } from "@/lib/types";
import {
  pruneShopChecks,
  shopItemKey,
  writeShopChecks,
} from "@/lib/shop-checks";
import {
  shoppingListPdf,
  shoppingListPdfFilename,
} from "@/meals/shopping-list-pdf";

const AISLE_LABELS: Record<Aisle, string> = {
  produce: "Produce",
  meat: "Meat & fish",
  dairy: "Dairy",
  pantry: "Pantry",
  other: "Other",
};

function liveKeys(groups: ShoppingList): string[] {
  return groups.flatMap((group) =>
    group.items.map((item) => shopItemKey(item)),
  );
}

async function pdfFile(groups: ShoppingList, weekLabel: string): Promise<File> {
  const blob = await shoppingListPdf({ groups, weekLabel });
  return new File([blob], shoppingListPdfFilename(weekLabel), {
    type: "application/pdf",
  });
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

export function ShoppingListView({
  planId,
  weekLabel,
  groups,
}: {
  planId: string;
  weekLabel: string;
  groups: ShoppingList;
}) {
  const keys = useMemo(() => liveKeys(groups), [groups]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChecked(pruneShopChecks(planId, keys));
  }, [planId, keys]);

  function toggle(key: string) {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setChecked(next);
    writeShopChecks(planId, next);
  }

  async function onPrint() {
    setBusy(true);
    try {
      const file = await pdfFile(groups, weekLabel);
      const url = URL.createObjectURL(file);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    setBusy(true);
    try {
      const file = await pdfFile(groups, weekLabel);
      const payload = { files: [file], title: file.name };
      if (navigator.share && navigator.canShare?.(payload)) {
        await navigator.share(payload);
        return;
      }
      downloadFile(file);
    } finally {
      setBusy(false);
    }
  }

  if (groups.length === 0) {
    return <p className="page-lede">Fill the plan to build a shopping list.</p>;
  }

  return (
    <div>
      <div className="no-print mb-4 flex gap-1">
        <button
          type="button"
          className="icon-button"
          aria-label="Print shopping list"
          title="Print shopping list"
          disabled={busy}
          onClick={() => void onPrint()}
        >
          <PrinterIcon />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Share shopping list"
          title="Share shopping list"
          disabled={busy}
          onClick={() => void onShare()}
        >
          <ShareIcon />
        </button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group.aisle} className="surface p-5">
            <h2 className="page-eyebrow">
              {AISLE_LABELS[group.aisle] ?? group.aisle}
            </h2>
            <ul className="mt-3">
              {group.items.map((item) => {
                const key = shopItemKey(item);
                const isChecked = checked.has(key);
                return (
                  <li
                    key={key}
                    className="flex items-center gap-3 border-b border-wheat/80 py-2.5 last:border-b-0"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="shop-check"
                        checked={isChecked}
                        onChange={() => toggle(key)}
                      />
                      <span
                        className={
                          isChecked ? "text-herb line-through" : undefined
                        }
                      >
                        {item.name}
                      </span>
                    </label>
                    <span className="shrink-0 font-mono text-[0.78rem] text-herb">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function PrinterIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.2 7.2V3.4h9.6v3.8" />
      <path d="M5.2 14.2H3.8A1.4 1.4 0 0 1 2.4 12.8V8.6A1.4 1.4 0 0 1 3.8 7.2h12.4A1.4 1.4 0 0 1 17.6 8.6v4.2a1.4 1.4 0 0 1-1.4 1.4h-1.4" />
      <rect x="5.2" y="11.6" width="9.6" height="5" rx="0.8" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="15.2" cy="4.8" r="1.7" />
      <circle cx="15.2" cy="15.2" r="1.7" />
      <circle cx="4.8" cy="10" r="1.7" />
      <path d="M6.4 9.3 13.5 5.7" />
      <path d="M6.4 10.7 13.5 14.3" />
    </svg>
  );
}
