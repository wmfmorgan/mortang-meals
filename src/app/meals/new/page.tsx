import Link from "next/link";
import { MealDetail } from "@/components/meal-detail";
import { requirePageHousehold } from "@/lib/request-auth";

export default async function NewRecipePage() {
  const { household } = await requirePageHousehold();

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
        servings={`Serves ${household.servings}`}
        canSwap={false}
        eyebrow="New recipe"
      />
    </article>
  );
}
