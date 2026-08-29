import Link from "next/link";
import { MealDetail } from "@/components/meal-detail";
import { getHousehold } from "@/household/repo";

export default function NewRecipePage() {
  const household = getHousehold();

  return (
    <article className="recipe-page mx-auto max-w-2xl">
      <Link
        href="/meals"
        className="no-print mb-6 inline-block text-sm text-herb no-underline hover:text-ink"
      >
        ← Meals
      </Link>
      <MealDetail
        mode="create"
        servings={household ? `Serves ${household.servings}` : "Serves household"}
        canSwap={false}
        eyebrow="New recipe"
      />
    </article>
  );
}
