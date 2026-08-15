"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrashIcon } from "./meal-card";

type PlanOption = {
  id: string;
  weekStart: string;
  isCurrent: boolean;
};

function newestIdForWeek(plans: PlanOption[], weekStart: string): string {
  const match = plans.find((plan) => plan.weekStart === weekStart);
  return match?.id ?? plans[0]?.id ?? "";
}

export function PlanPicker({
  plans,
  selectedId,
  hrefPrefix = "/?plan=",
  homeHref = "/",
}: {
  plans: PlanOption[];
  selectedId?: string;
  hrefPrefix?: string;
  homeHref?: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (plans.length === 0) return null;

  async function onDelete(planId: string) {
    setPendingId(planId);
    try {
      const res = await fetch("/api/plans/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) return;
      if (selectedId === planId) {
        router.push(homeHref);
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <ul className="plan-picker">
      {plans.map((item) => {
        const selected = item.id === selectedId;
        const newestId = newestIdForWeek(plans, item.weekStart);
        return (
          <li key={item.id} className="flex items-center gap-1.5">
            <Link
              href={`${hrefPrefix}${item.id}`}
              aria-current={selected ? "page" : undefined}
            >
              {item.weekStart}
            </Link>
            {item.isCurrent ? (
              <Link
                href={`${hrefPrefix}${newestId}`}
                className="badge badge-link"
                title="Open the newest plan for this week"
              >
                current
              </Link>
            ) : null}
            <button
              type="button"
              className="icon-button icon-button-danger plan-delete"
              aria-label={`Delete plan ${item.weekStart}`}
              title="Delete this week (keep the recipes)"
              disabled={pendingId === item.id}
              onClick={() => {
                void onDelete(item.id);
              }}
            >
              <TrashIcon />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
