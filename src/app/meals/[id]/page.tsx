import { notFound } from "next/navigation";
import { SwapButton } from "@/components/meal-card";
import { getHousehold } from "@/household/repo";
import { getPlan, listPlans } from "@/meals/repo";

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
    <div className="max-w-xl space-y-4">
      <a href="/" className="text-blue-700 underline">
        Back
      </a>
      <h1 className="text-2xl font-semibold">{meal.title}</h1>
      <p className="text-sm text-zinc-600">
        {meal.day} {meal.slot}
        {household ? ` · Servings ${household.servings}` : ""}
        {` · ${meal.cookMinutes} min · ${meal.method}`}
      </p>
      <p>{meal.whyItFits}</p>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Ingredients</h2>
        <ul className="list-disc space-y-1 pl-5">
          {meal.ingredients.map((ingredient) => (
            <li key={`${ingredient.name}-${ingredient.unit}`}>
              {ingredient.quantity} {ingredient.unit} {ingredient.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Steps</h2>
        <ol className="list-decimal space-y-1 pl-5">
          {meal.steps.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      </section>

      <SwapButton meal={meal} />
    </div>
  );
}
