import { PageHeader } from "@/components/page-header";
import { getHousehold } from "@/household/repo";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { KitchenForm } from "./kitchen-form";

export default function KitchenPage() {
  seedKitchenIfEmpty();
  const items = listKitchen();
  const prefs = getKitchenPrefs();
  const household = getHousehold();
  const seeded = prefs.overallDiet.trim()
    ? prefs
    : { ...prefs, overallDiet: household?.dietStyle ?? "" };

  return (
    <div>
      <PageHeader
        eyebrow="Methods"
        title="Kitchen"
        lede="How you cook, then which appliances and methods the planner may use."
      />
      <KitchenForm items={items} prefs={seeded} />
    </div>
  );
}
