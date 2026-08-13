import { redirect } from "next/navigation";
import { GenerateButton } from "@/components/generate-button";
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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">This Week</h1>

      {plans.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-3">
          {plans.map((item) => {
            const selected = item.id === plan?.id;
            return (
              <li key={item.id} className="flex items-center gap-1">
                <a
                  href={`/?plan=${item.id}`}
                  className={
                    selected
                      ? "font-semibold text-zinc-900"
                      : "text-blue-700 underline"
                  }
                  aria-current={selected ? "page" : undefined}
                >
                  {item.weekStart}
                </a>
                {item.isCurrent ? (
                  <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">
                    current
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {blocker ? <p>{blocker}</p> : null}

      <GenerateButton
        disabledReason={blocker}
        weekStart={plan?.weekStart}
        planSlotMask={plan?.slotMask ?? null}
      />

      <WeekGrid plan={plan} />
    </div>
  );
}
