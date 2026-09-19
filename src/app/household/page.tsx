import { PageHeader } from "@/components/page-header";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { requirePageHousehold } from "@/lib/request-auth";
import { HouseholdKitchenForm } from "./household-kitchen-form";

export default async function HouseholdPage() {
  const { household, householdId } = await requirePageHousehold();
  await seedKitchenIfEmpty(householdId);
  const items = await listKitchen(householdId);
  const prefs = await getKitchenPrefs(householdId);

  return (
    <div>
      <PageHeader
        eyebrow="Profiles"
        title="Household & Dietary Preferences"
        lede="Who you cook for, how you cook, and which appliances library generate may use."
      />
      <HouseholdKitchenForm
        household={household}
        items={items}
        prefs={prefs}
      />
    </div>
  );
}
