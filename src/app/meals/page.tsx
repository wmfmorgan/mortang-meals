import { PageHeader } from "@/components/page-header";
import { MealsCatalog } from "@/components/meals-catalog";
import { getHousehold } from "@/household/repo";
import { getCurrentPlan, listAllMeals } from "@/meals/repo";

export default function MealsPage() {
  const meals = listAllMeals();
  const household = getHousehold();
  const current = getCurrentPlan();

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Meals"
        lede="Everything generated, placed, or imported. Search, filter, or add a recipe from a URL."
      />
      <MealsCatalog
        meals={meals}
        servings={household?.servings ?? 2}
        currentPlanId={current?.id ?? null}
      />
    </div>
  );
}
