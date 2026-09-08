import { PageHeader } from "@/components/page-header";
import { PlanSwitcher } from "@/components/plan-switcher";
import { ShoppingListView } from "@/components/shopping-list-view";
import { weekRangeLabel } from "@/lib/week";
import { listPlans, resolveOpenPlan } from "@/meals/repo";
import { mergeShoppingList } from "@/meals/shopping-list";

export default async function ShoppingListPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planId } = await searchParams;
  const plans = listPlans();
  const plan = resolveOpenPlan(planId);
  const groups = mergeShoppingList(plan.meals);
  const weekLabel = weekRangeLabel(plan.weekStart);

  return (
    <div>
      <PageHeader
        eyebrow={weekLabel}
        title="Shopping list"
        lede="Merged from the open week. Same ingredient is one line."
      />

      <div className="no-print">
        <PlanSwitcher
          plans={plans}
          selectedId={plan.id}
          hrefPrefix="/shopping-list?plan="
          homeHref="/shopping-list"
        />
      </div>

      <ShoppingListView
        planId={plan.id}
        weekLabel={weekLabel}
        groups={groups}
      />
    </div>
  );
}
