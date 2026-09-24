import { MealsCatalog } from "@/components/meals-catalog";
import { requirePageHousehold } from "@/lib/request-auth";
import { mondayOf } from "@/lib/week";
import { getCurrentPlan, listCatalogMeals, listDraftMeals } from "@/meals/repo";

export default async function MealsPage() {
  const { household, householdId } = await requirePageHousehold();
  const meals = await listCatalogMeals(householdId);
  const current = await getCurrentPlan(householdId);

  return (
    <MealsCatalog
      meals={meals}
      drafts={await listDraftMeals(householdId)}
      people={household.people}
      householdName={household.name}
      servings={household.servings}
      currentPlanId={current?.id ?? null}
      weekStart={current?.weekStart ?? mondayOf(new Date())}
    />
  );
}
