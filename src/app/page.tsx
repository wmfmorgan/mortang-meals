import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PlanPicker } from "@/components/plan-picker";
import { ThisWeekPlanner } from "@/components/this-week-planner";
import { WeekSwitcher } from "@/components/week-switcher";
import { getHousehold } from "@/household/repo";
import { mondayOf } from "@/lib/week";
import { getCurrentPlan, getPlan, listPlans } from "@/meals/repo";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const household = getHousehold();
  if (!household || household.people.length === 0) {
    redirect("/setup");
  }

  const { plan: planId } = await searchParams;
  const plans = listPlans();
  const requested = planId ? getPlan(planId) : null;
  const plan = requested ?? getCurrentPlan();
  const weekStart = plan?.weekStart ?? mondayOf(new Date());

  return (
    <div>
      <PageHeader
        eyebrow={weekStart}
        title="This week"
        lede="Build the week from your library. Mark takeout, copy leftovers, or fill empty slots."
      />

      <WeekSwitcher weekStart={weekStart} />

      <PlanPicker
        plans={plans}
        selectedId={plan?.id}
        hrefPrefix="/?plan="
      />

      <ThisWeekPlanner
        plan={plan}
        weekStart={weekStart}
        servings={household.servings}
      />
    </div>
  );
}
