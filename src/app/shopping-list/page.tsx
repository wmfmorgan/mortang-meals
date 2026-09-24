import { PlanSwitcher } from "@/components/plan-switcher";
import { ShoppingListView } from "@/components/shopping-list-view";
import { requirePageHousehold } from "@/lib/request-auth";
import { weekRangeLabel } from "@/lib/week";
import { listPlans, resolveOpenPlan } from "@/meals/repo";
import { mergeShoppingList } from "@/meals/shopping-list";

export default async function ShoppingListPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { household, householdId } = await requirePageHousehold();
  const { plan: planId } = await searchParams;
  const plans = await listPlans(householdId);
  const plan = await resolveOpenPlan(householdId, planId);
  const groups = mergeShoppingList(plan.meals);
  const weekLabel = weekRangeLabel(plan.weekStart);
  const plannedMeals = plan.meals.filter(
    (meal) => !meal.takeout && !meal.leftover,
  ).length;

  return (
    <div>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="page-eyebrow">{weekLabel}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">Shopping list</h1>
            {plannedMeals > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-olive/15 px-3 py-1 text-[0.65rem] font-medium tracking-wider text-olive-deep uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-olive" />
                {plannedMeals} planned meal{plannedMeals === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
        <div className="no-print">
          <PlanSwitcher
            plans={plans}
            selectedId={plan.id}
            hrefPrefix="/shopping-list?plan="
            homeHref="/shopping-list"
          />
        </div>
      </header>

      <ShoppingListView
        planId={plan.id}
        weekLabel={weekLabel}
        groups={groups}
        people={household.people}
      />
    </div>
  );
}
