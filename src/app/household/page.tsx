import { PageHeader } from "@/components/page-header";
import { getHousehold } from "@/household/repo";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { HouseholdForm } from "./household-form";

export default function HouseholdPage() {
  const household = getHousehold();
  const kitchenDiet = getKitchenPrefs().overallDiet.trim();
  const householdDiet = household?.dietStyle.trim() ?? "";

  return (
    <div>
      <PageHeader
        eyebrow="Profiles"
        title="Household"
        lede="Who you cook for: names, allergies, avoidances, and servings."
      />
      {household && !householdDiet && !kitchenDiet ? (
        <p className="mb-4 text-sm text-herb">
          Set an overall diet on Kitchen so library generate has a default.
        </p>
      ) : null}
      <HouseholdForm household={household} />
    </div>
  );
}
