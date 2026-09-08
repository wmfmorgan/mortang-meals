import type { WeekPlan } from "./types";
import { planDisplayName, weekMonthLabel } from "./week";

export type PlanSummary = Pick<
  WeekPlan,
  "id" | "weekStart" | "isCurrent" | "name" | "favorited"
>;

export function groupPlansForMenu(plans: PlanSummary[]): {
  favorites: PlanSummary[];
  months: { key: string; label: string; plans: PlanSummary[] }[];
} {
  const favorites = plans
    .filter((plan) => plan.favorited)
    .sort((a, b) => {
      const nameDelta = planDisplayName(a).localeCompare(planDisplayName(b));
      if (nameDelta !== 0) return nameDelta;
      return b.weekStart.localeCompare(a.weekStart);
    });
  const rest = plans.filter((plan) => !plan.favorited);
  const byMonth = new Map<string, PlanSummary[]>();
  for (const plan of rest) {
    const key = plan.weekStart.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(plan);
    byMonth.set(key, list);
  }
  const months = [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, monthPlans]) => ({
      key,
      label: weekMonthLabel(monthPlans[0]!.weekStart),
      plans: monthPlans.sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    }));
  return { favorites, months };
}
