import { notFound } from "next/navigation";
import { MealDetail } from "@/components/meal-detail";
import { cookExit } from "@/lib/cook-exit";
import { requirePageHousehold } from "@/lib/request-auth";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; plan?: string }>;
}) {
  const { household, householdId } = await requirePageHousehold();
  const { id } = await params;
  const query = await searchParams;
  const meal = await getMeal(householdId, id);
  if (!meal) notFound();
  const exit = cookExit(query.from, query.plan);

  const current = await getCurrentPlan(householdId);
  const onCurrentWeek = Boolean(current?.meals.some((item) => item.id === meal.id));
  const eyebrow = onCurrentWeek
    ? `${DAY_LABELS[meal.day]} ${meal.slot}`
    : meal.sourceUrl
      ? `Imported ${meal.slot}`
      : meal.slot;

  return (
    <article className="recipe-page cook-page">
      <MealDetail
        meal={meal}
        servings={`Serves ${household.servings}`}
        canSwap={onCurrentWeek}
        eyebrow={eyebrow}
        people={household.people}
        exit={exit}
      />
    </article>
  );
}
