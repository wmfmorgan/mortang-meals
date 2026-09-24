"use client";

import { useEffect, useMemo, useState } from "react";
import type { Aisle, Person, ShoppingItem, ShoppingList } from "@/lib/types";
import {
  pruneShopChecks,
  shopItemKey,
  writeShopChecks,
} from "@/lib/shop-checks";
import {
  itemHitsAllergies,
  shoppingItemFlags,
} from "@/meals/shopping-flags";
import { AISLE_LABELS } from "@/meals/shopping-list";
import {
  shoppingListPdf,
  shoppingListPdfFilename,
} from "@/meals/shopping-list-pdf";

const AISLE_WASH: Record<Aisle, string> = {
  produce: "bg-breakfast-wash",
  meat: "bg-lunch-wash",
  dairy: "bg-breakfast-wash",
  pantry: "bg-dinner-wash",
  other: "bg-lunch-wash",
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

function namedPeople(people: Person[]): Person[] {
  return people.filter((person) => person.name.trim());
}

function allergyPeople(people: Person[]): Person[] {
  return namedPeople(people).filter((person) =>
    person.allergies.some((term) => term.trim()),
  );
}

function quantityLabel(item: ShoppingItem): string {
  return [item.quantity, item.unit].filter(Boolean).join(" ");
}

export function ShoppingListView({
  planId,
  weekLabel,
  groups,
  people = [],
}: {
  planId: string;
  weekLabel: string;
  groups: ShoppingList;
  people?: Person[];
}) {
  const keys = useMemo(() => liveKeys(groups), [groups]);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [filterId, setFilterId] = useState<string>("all");

  useEffect(() => {
    setChecked(pruneShopChecks(planId, keys));
  }, [planId, keys]);

  function toggle(key: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeShopChecks(planId, next);
      return next;
    });
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

  const guards = namedPeople(people);
  const filterable = allergyPeople(people);
  const filterPerson = filterable.find((person) => person.id === filterId);

  const visibleGroups = useMemo(() => {
    if (!filterPerson) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => !itemHitsAllergies(item.name, filterPerson.allergies),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, filterPerson]);

  const visibleItems = visibleGroups.flatMap((group) => group.items);
  const visibleCount = visibleItems.length;
  const checkedVisible = visibleItems.filter((item) =>
    checked.has(shopItemKey(item)),
  ).length;
  const percent =
    visibleCount === 0 ? 0 : Math.round((checkedVisible / visibleCount) * 100);
  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);

  if (groups.length === 0) {
    return <p className="page-lede">Fill the plan to build a shopping list.</p>;
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {filterable.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={filterChipClass(filterId === "all")}
              aria-pressed={filterId === "all"}
              onClick={() => setFilterId("all")}
            >
              All household ({totalItems} items)
            </button>
            {filterable.map((person) => (
              <button
                key={person.id}
                type="button"
                className={filterChipClass(filterId === person.id)}
                aria-pressed={filterId === person.id}
                onClick={() => setFilterId(person.id)}
              >
                Safe for {person.name}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary gap-1.5 rounded-full px-4"
            aria-label="Print shopping list"
            title="Print shopping list"
            disabled={busy}
            onClick={() => void onPrint()}
          >
            <PrinterIcon />
            <span className="hidden sm:inline">Export &amp; Print</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary gap-1.5 rounded-full px-4"
            aria-label="Share shopping list"
            title="Share shopping list"
            disabled={busy}
            onClick={() => void onShare()}
          >
            <ShareIcon />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </div>

      <div
        className={
          guards.length > 0
            ? "grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
            : ""
        }
      >
        <div
          className={
            guards.length > 0
              ? "flex flex-col gap-4 lg:col-span-8"
              : "flex flex-col gap-4"
          }
        >
          <div className="no-print flex flex-col justify-between gap-3 rounded-2xl bg-surface-low p-4 shadow-sm sm:flex-row sm:items-center">
            <div>
              <div className="font-display text-base font-semibold tracking-tight">
                Batch progress
              </div>
              <div className="text-sm text-herb">
                {checkedVisible} of {visibleCount} items marked gathered
              </div>
            </div>
            <div className="flex w-full items-center gap-3 sm:w-48">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper shadow-inner">
                <div
                  className="h-2.5 rounded-full bg-olive transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="shrink-0 text-[0.65rem] font-semibold tracking-wider text-ink">
                {percent}%
              </span>
            </div>
          </div>

          {visibleGroups.length === 0 && filterPerson ? (
            <p className="page-lede">
              No items left that look safe for {filterPerson.name}.
            </p>
          ) : null}

          {visibleGroups.map((group) => (
            <section
              key={group.aisle}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
            >
              <header
                className={`${AISLE_WASH[group.aisle]} flex items-center justify-between px-4 py-2.5`}
              >
                <h2 className="m-0 font-display text-base font-semibold tracking-tight">
                  {AISLE_LABELS[group.aisle] ?? group.aisle}
                </h2>
                <span className="rounded-full bg-paper px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-[0.14em] text-herb uppercase">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "item" : "items"}
                </span>
              </header>
              <ul className="m-0 flex list-none flex-col divide-y divide-wheat/40 p-2">
                {group.items.map((item) => {
                  const key = shopItemKey(item);
                  const isChecked = checked.has(key);
                  const flags = shoppingItemFlags(item.name, people);
                  return (
                    <li key={key}>
                      <label className="group flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-linen/40">
                        <input
                          type="checkbox"
                          className="shop-check mt-0.5"
                          checked={isChecked}
                          onChange={() => toggle(key)}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={
                              isChecked
                                ? "font-medium text-herb line-through"
                                : "font-medium text-ink"
                            }
                          >
                            {item.name}
                            {quantityLabel(item) ? (
                              <span className="font-normal text-herb">
                                {" "}
                                · {quantityLabel(item)}
                              </span>
                            ) : null}
                          </span>
                          {item.sources.length > 0 || flags.length > 0 ? (
                            <span className="mt-1.5 flex flex-wrap gap-1.5">
                              {item.sources.map((title) => (
                                <span
                                  key={title}
                                  className="inline-flex rounded-full bg-surface-low px-2 py-0.5 text-[11px] font-medium text-herb"
                                >
                                  {title}
                                </span>
                              ))}
                              {flags.map((flag) => (
                                <span
                                  key={`${flag.personId}-${flag.kind}-${flag.term}`}
                                  className={
                                    flag.kind === "allergy"
                                      ? "inline-flex rounded-full bg-alert-wash px-2 py-0.5 text-[11px] font-medium text-primary"
                                      : "inline-flex rounded-full bg-olive/15 px-2 py-0.5 text-[11px] font-medium text-olive-deep"
                                  }
                                >
                                  {flag.personName} · {flag.term}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {guards.length > 0 ? (
          <aside className="no-print flex flex-col gap-4 lg:col-span-4 lg:sticky lg:top-24">
            <section className="rounded-3xl bg-white p-4 shadow-sm">
              <h2 className="mt-0 mb-3 font-display text-base font-semibold tracking-tight">
                Household dietary guards
              </h2>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {guards.map((person) => {
                  const allergies = person.allergies.filter((term) => term.trim());
                  const avoidances = person.avoidances.filter((term) =>
                    term.trim(),
                  );
                  return (
                    <li key={person.id} className="rounded-2xl bg-surface-low p-3">
                      <div className="font-display text-sm font-semibold">
                        {person.name}
                      </div>
                      {allergies.length === 0 && avoidances.length === 0 ? (
                        <p className="mt-1 mb-0 text-xs text-herb">
                          No listed allergies
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {allergies.map((term) => (
                            <span
                              key={`a-${term}`}
                              className="rounded-full bg-alert-wash px-2 py-0.5 text-[11px] font-medium text-primary"
                            >
                              {term}
                            </span>
                          ))}
                          {avoidances.map((term) => (
                            <span
                              key={`v-${term}`}
                              className="rounded-full bg-olive/15 px-2 py-0.5 text-[11px] font-medium text-olive-deep"
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function filterChipClass(active: boolean): string {
  return active
    ? "inline-flex min-h-11 items-center rounded-full bg-primary px-3 py-1.5 text-[0.8125rem] font-semibold text-paper"
    : "inline-flex min-h-11 items-center rounded-full border border-wheat bg-paper px-3 py-1.5 text-[0.8125rem] font-medium text-herb hover:border-olive hover:text-ink";
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
