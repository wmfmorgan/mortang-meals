import Link from "next/link";
import { notFound } from "next/navigation";
import { SwapButton, WebSearchStar } from "@/components/meal-card";
import { PageHeader } from "@/components/page-header";
import { getHousehold } from "@/household/repo";
import { getPlan, listPlans } from "@/meals/repo";

const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
} as const;

function findMeal(id: string) {
  for (const summary of listPlans()) {
    const plan = getPlan(summary.id);
    const meal = plan?.meals.find((item) => item.id === id);
    if (meal) return meal;
  }
  return null;
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meal = findMeal(id);
  if (!meal) notFound();

  const household = getHousehold();

  return (
    <article className="mx-auto max-w-2xl">
      <Link href="/" className="mb-6 inline-block text-sm text-herb no-underline hover:text-ink">
        ← This week
      </Link>
      <PageHeader
        eyebrow={`${DAY_LABELS[meal.day]} ${meal.slot}`}
        title={
          meal.usedWebSearch ? (
            <span className="inline-flex items-center gap-2">
              <WebSearchStar />
              {meal.title}
            </span>
          ) : (
            meal.title
          )
        }
        lede={meal.whyItFits}
        action={<SwapButton meal={meal} />}
      />
      <p className="mb-8 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-herb">
        {household ? `Serves ${household.servings}` : "Serves household"}
        {` · ${meal.cookMinutes} min · ${meal.method}`}
      </p>

      <div className="surface grid gap-8 p-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:p-8">
        <section>
          <h2 className="page-eyebrow">Ingredients</h2>
          <ul className="mt-3 space-y-2">
            {meal.ingredients.map((ingredient) => (
              <li
                key={`${ingredient.name}-${ingredient.unit}`}
                className="flex gap-3 border-b border-wheat/80 py-2 text-[0.95rem]"
              >
                <span className="w-24 shrink-0 font-mono text-[0.78rem] text-herb">
                  {ingredient.quantity} {ingredient.unit}
                </span>
                <span>{ingredient.name}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="page-eyebrow">Method</h2>
          <ol className="mt-3 space-y-3">
            {meal.steps.map((step, index) => (
              <li key={`${index}-${step}`} className="flex gap-3 text-[0.98rem] leading-relaxed">
                <span className="font-mono text-[0.72rem] text-olive">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
