import { PageHeader } from "@/components/page-header";
import { PlanPicker } from "@/components/plan-picker";
import { getCurrentPlan, getPlan, listPlans } from "@/meals/repo";
import { mergeShoppingList } from "@/meals/shopping-list";

const AISLE_LABELS = {
  produce: "Produce",
  meat: "Meat & fish",
  dairy: "Dairy",
  pantry: "Pantry",
  other: "Other",
} as const;

export default async function ShoppingListPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan: planId } = await searchParams;
  const plans = listPlans();
  const requested = planId ? getPlan(planId) : null;
  const plan = requested ?? getCurrentPlan();
  const groups = plan ? mergeShoppingList(plan.meals) : [];

  return (
    <div>
      <PageHeader
        eyebrow={plan?.weekStart ?? "Market list"}
        title="Shopping list"
        lede="Merged from the open week. Quantities are combined when the name and unit match."
      />

      <PlanPicker
        plans={plans}
        selectedId={plan?.id}
        hrefPrefix="/shopping-list?plan="
        homeHref="/shopping-list"
      />

      {groups.length === 0 ? (
        <p className="page-lede">Generate a week to build a shopping list.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {groups.map((group) => (
            <section key={group.aisle} className="surface p-5">
              <h2 className="page-eyebrow">
                {AISLE_LABELS[group.aisle] ?? group.aisle}
              </h2>
              <ul className="mt-3">
                {group.items.map((item) => (
                  <li
                    key={`${item.name}-${item.unit}`}
                    className="flex items-baseline justify-between gap-4 border-b border-wheat/80 py-2.5 last:border-b-0"
                  >
                    <span>{item.name}</span>
                    <span className="shrink-0 font-mono text-[0.78rem] text-herb">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
