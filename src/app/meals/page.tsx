import { PageHeader } from "@/components/page-header";
import { MealsCatalog } from "@/components/meals-catalog";
import { getHousehold } from "@/household/repo";
import { getCurrentPlan, listCatalogMeals, listDraftMeals } from "@/meals/repo";

export default function MealsPage() {
  const meals = listCatalogMeals();
  const household = getHousehold();
  const current = getCurrentPlan();

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Meals"
        lede="Search the saved library. Approve drafts, then add more from generate or import."
      />
      <MealsCatalog
        meals={meals}
        drafts={listDraftMeals()}
        people={household?.people ?? []}
        servings={household?.servings ?? 2}
        currentPlanId={current?.id ?? null}
      />
    </div>
  );
}
