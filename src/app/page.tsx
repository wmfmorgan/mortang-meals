import { redirect } from "next/navigation";
import { GenerateButton } from "@/components/generate-button";
import { PageHeader } from "@/components/page-header";
import { PlanPicker } from "@/components/plan-picker";
import { WeekGrid } from "@/components/week-grid";
import { getHousehold } from "@/household/repo";
import type { Household } from "@/lib/types";
import { getCurrentPlan, getPlan, listPlans } from "@/meals/repo";

function generateBlocker(household: Household): string | null {
  const hasNamedPerson = household.people.some((person) => person.name.trim());
  if (household.people.length === 0 || !hasNamedPerson) {
    return "Add people before generating.";
  }
  if (!household.dietStyle.trim()) {
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
        lede="A seven-day menu for the table. Generate a plan, open a card to cook, swap anything that doesn’t land."
        action={
          <div className="space-y-2">
            <GenerateButton
              disabledReason={blocker}
              weekStart={plan?.weekStart}
              planSlotMask={plan?.slotMask ?? null}
            />
            {blocker ? <p className="max-w-xs text-sm text-herb">{blocker}</p> : null}
          </div>
        }
      />

      <PlanPicker
        plans={plans}
        selectedId={plan?.id}
        hrefFor={(id) => `/?plan=${id}`}
      />

      <WeekGrid plan={plan} />
    </div>
  );
}
