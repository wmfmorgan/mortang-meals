import { getCurrentPlan, getPlan, listPlans } from "@/meals/repo";
import { mergeShoppingList } from "@/meals/shopping-list";

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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Shopping list</h1>

      {plans.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-3">
          {plans.map((item) => {
            const selected = item.id === plan?.id;
            return (
              <li key={item.id} className="flex items-center gap-1">
                <a
                  href={`/shopping-list?plan=${item.id}`}
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

      {groups.length === 0 ? (
        <p>Generate a week to build a shopping list.</p>
      ) : (
        groups.map((group) => (
          <section key={group.aisle} className="space-y-2">
            <h2 className="text-lg font-medium">{group.aisle}</h2>
            <ul className="list-disc space-y-1 pl-5">
              {group.items.map((item) => (
                <li key={`${item.name}-${item.unit}`}>
                  {item.quantity} {item.unit} {item.name}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
