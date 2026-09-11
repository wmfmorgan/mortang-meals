import { PageHeader } from "@/components/page-header";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { requirePageHousehold } from "@/lib/request-auth";
import { HouseholdForm } from "./household-form";

export default async function HouseholdPage() {
  const { household, householdId } = await requirePageHousehold();
  const kitchenDiet = (await getKitchenPrefs(householdId)).overallDiet.trim();
  const householdDiet = household.dietStyle.trim();

  return (
    <div>
      <PageHeader
        eyebrow="Profiles"
        title="Household"
        lede="Who you cook for: names, allergies, avoidances, and servings."
      />
      {!householdDiet && !kitchenDiet ? (
        <p className="mb-4 text-sm text-herb">
          Set an overall diet on Kitchen so library generate has a default.
        </p>
      ) : null}
      <HouseholdForm household={household} />
    </div>
  );
}
