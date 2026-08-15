import Link from "next/link";
import { notFound } from "next/navigation";
import { MealDetail } from "@/components/meal-detail";
import { getHousehold } from "@/household/repo";
import { getCurrentPlan, getMeal } from "@/meals/repo";

const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
} as const;

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meal = getMeal(id);
  if (!meal) notFound();

  const household = getHousehold();
  const current = getCurrentPlan();
  const onCurrentWeek = Boolean(current?.meals.some((item) => item.id === meal.id));
  const eyebrow = onCurrentWeek
    ? `${DAY_LABELS[meal.day]} ${meal.slot}`
    : meal.sourceUrl
      ? `Imported ${meal.slot}`
      : meal.slot;

  return (
    <article className="mx-auto max-w-2xl">
      <Link
        href="/meals"
        className="mb-6 inline-block text-sm text-herb no-underline hover:text-ink"
      >
        ← Meals
      </Link>
      <MealDetail
        meal={meal}
        servings={household ? `Serves ${household.servings}` : "Serves household"}
        canSwap={onCurrentWeek}
        eyebrow={eyebrow}
      />
    </article>
  );
}
