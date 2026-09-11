import { PageHeader } from "@/components/page-header";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { requirePageHousehold } from "@/lib/request-auth";
import { KitchenForm } from "./kitchen-form";

export default async function KitchenPage() {
  const { household, householdId } = await requirePageHousehold();
  await seedKitchenIfEmpty(householdId);
  const items = await listKitchen(householdId);
  const prefs = await getKitchenPrefs(householdId);
  const seeded = prefs.overallDiet.trim()
    ? prefs
    : { ...prefs, overallDiet: household.dietStyle };

  return (
    <div>
      <PageHeader
        eyebrow="Methods"
        title="Kitchen"
        lede="How you cook, then which appliances and methods library generate may use."
      />
      <KitchenForm items={items} prefs={seeded} />
    </div>
  );
}
