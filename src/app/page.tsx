import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PlanPicker } from "@/components/plan-picker";
import { ThisWeekPlanner } from "@/components/this-week-planner";
import { getHousehold } from "@/household/repo";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import type { Household } from "@/lib/types";
import { getCurrentPlan, getPlan, listPlans } from "@/meals/repo";

function generateBlocker(household: Household): string | null {
  const hasNamedPerson = household.people.some((person) => person.name.trim());
  if (household.people.length === 0 || !hasNamedPerson) {
    return "Add people before generating.";
  }
  const prefs = getKitchenPrefs();
  if (!household.dietStyle.trim() && !prefs.overallDiet.trim()) {
    return "Add a diet style before generating.";
  }
  return null;
}

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
  const blocker = generateBlocker(household);

  return (
    <div>
      <PageHeader
        eyebrow={plan?.weekStart ?? household.dietStyle}
        title="This week"
        lede="Pick breakfast, lunch, and dinner for each day, then generate. Open a card for the recipe."
      />

      <PlanPicker
        plans={plans}
        selectedId={plan?.id}
        hrefPrefix="/?plan="
      />

      {blocker ? <p className="mb-4 text-sm text-herb">{blocker}</p> : null}

      <ThisWeekPlanner
        plan={plan}
        weekStart={plan?.weekStart}
        servings={household.servings}
        disabledReason={blocker}
      />
    </div>
  );
}
