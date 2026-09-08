"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { groupPlansForMenu, type PlanSummary } from "@/lib/plan-nav";
import { mondayOf } from "@/lib/week";
import { planDisplayName, weekRangeLabel } from "@/lib/week";

export function PlanSwitcher({
  plans,
  selectedId,
  hrefPrefix = "/?plan=",
  homeHref = "/",
  allowDelete = false,
}: {
  plans: PlanSummary[];
  selectedId?: string;
  hrefPrefix?: string;
  homeHref?: string;
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [pending, setPending] = useState(false);

  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];
  const grouped = groupPlansForMenu(plans);
  const thisMonday = mondayOf(new Date());

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setRenaming(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!selected) return null;

  async function patch(planId: string, body: { name?: string; favorited?: boolean }) {
    setPending(true);
    try {
      const res = await fetch("/api/plans/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, ...body }),
      });
      if (!res.ok) return;
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!selected || !allowDelete) return;
    if (!window.confirm("Delete this week? Recipes stay in the library.")) return;
    setPending(true);
    try {
      const res = await fetch("/api/plans/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selected.id }),
      });
      if (!res.ok) return;
      router.push(homeHref);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function startRename() {
    if (!selected) return;
    setDraftName(selected.name);
    setRenaming(true);
    setMenuOpen(false);
  }

  async function saveRename() {
    if (!selected) return;
    setRenaming(false);
    const next = draftName.trim();
    if (next === selected.name.trim()) return;
    await patch(selected.id, { name: next });
  }

  const label = planDisplayName(selected);
  const range = weekRangeLabel(selected.weekStart);
  const meta = [
    selected.name.trim() ? range : null,
    selected.isCurrent ? "current" : null,
  ].filter(Boolean);

  return (
    <div className="plan-switcher" ref={rootRef}>
      <div className="plan-switcher-bar">
        <button
          type="button"
          className="icon-button"
          aria-pressed={selected.favorited}
          aria-label={
            selected.favorited ? "Unfavorite this plan" : "Favorite this plan"
          }
          title={selected.favorited ? "Unfavorite" : "Favorite"}
          disabled={pending}
          onClick={() => void patch(selected.id, { favorited: !selected.favorited })}
        >
          <StarIcon filled={selected.favorited} />
        </button>
        <div className="plan-switcher-copy">
          {renaming ? (
            <input
              className="input plan-switcher-name-input"
              value={draftName}
              autoFocus
              aria-label="Plan name"
              placeholder={range}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => void saveRename()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setRenaming(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="plan-switcher-name"
              onClick={startRename}
            >
              {label}
            </button>
          )}
          {meta.length > 0 ? (
            <p className="plan-switcher-meta">{meta.join(" · ")}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-expanded={menuOpen}
          aria-label="Open plan list"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <ChevronIcon open={menuOpen} />
        </button>
        {allowDelete ? (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => void onDelete()}
          >
            Delete this week
          </button>
        ) : null}
      </div>
      {menuOpen ? (
        <div className="plan-switcher-menu" role="listbox" aria-label="Saved plans">
          {grouped.favorites.length > 0 ? (
            <section>
              <h3 className="page-eyebrow">Favorites</h3>
              {grouped.favorites.map((plan) => (
                <PlanMenuRow
                  key={plan.id}
                  plan={plan}
                  selectedId={selected.id}
                  hrefPrefix={hrefPrefix}
                  thisMonday={thisMonday}
                  onPick={() => setMenuOpen(false)}
                />
              ))}
            </section>
          ) : null}
          {grouped.months.map((month) => (
            <section key={month.key}>
              <h3 className="page-eyebrow">{month.label}</h3>
              {month.plans.map((plan) => (
                <PlanMenuRow
                  key={plan.id}
                  plan={plan}
                  selectedId={selected.id}
                  hrefPrefix={hrefPrefix}
                  thisMonday={thisMonday}
                  onPick={() => setMenuOpen(false)}
                />
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlanMenuRow({
  plan,
  selectedId,
  hrefPrefix,
  thisMonday,
  onPick,
}: {
  plan: PlanSummary;
  selectedId: string;
  hrefPrefix: string;
  thisMonday: string;
  onPick: () => void;
}) {
  const label = planDisplayName(plan);
  const range = weekRangeLabel(plan.weekStart);
  const bits = [
    plan.name.trim() ? range : null,
    plan.isCurrent ? "current" : null,
    plan.weekStart === thisMonday && !plan.isCurrent ? "this week" : null,
  ].filter(Boolean);
  return (
    <Link
      href={`${hrefPrefix}${plan.id}`}
      role="option"
      aria-selected={plan.id === selectedId}
      className="plan-switcher-option"
      onClick={onPick}
    >
      <StarIcon filled={plan.favorited} />
      <span>
        <span className="plan-switcher-option-name">{label}</span>
        {bits.length > 0 ? (
          <span className="plan-switcher-option-meta">{bits.join(" · ")}</span>
        ) : null}
      </span>
    </Link>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    >
      <path d="m10 2.8 2.2 4.5 5 .7-3.6 3.5.9 4.9L10 14.2l-4.5 2.2.9-4.9L2.8 8l5-.7L10 2.8Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      {open ? <path d="m5 12 5-5 5 5" /> : <path d="m5 8 5 5 5-5" />}
    </svg>
  );
}
