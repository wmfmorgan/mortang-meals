import { PageHeader } from "@/components/page-header";
import { MealsCatalog } from "@/components/meals-catalog";
import { requirePageHousehold } from "@/lib/request-auth";
import { getCurrentPlan, listCatalogMeals, listDraftMeals } from "@/meals/repo";

export default async function MealsPage() {
  const { household, householdId } = await requirePageHousehold();
  const meals = await listCatalogMeals(householdId);
  const current = await getCurrentPlan(householdId);

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Meals"
        lede="Search the saved library. Approve drafts, then add more from generate or import."
      />
      <MealsCatalog
        meals={meals}
        drafts={await listDraftMeals(householdId)}
        people={household.people}
        servings={household.servings}
        currentPlanId={current?.id ?? null}
      />
    </div>
  );
}
