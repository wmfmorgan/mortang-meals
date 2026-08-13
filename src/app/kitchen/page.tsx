import { PageHeader } from "@/components/page-header";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { KitchenForm } from "./kitchen-form";

export default function KitchenPage() {
  seedKitchenIfEmpty();
  const items = listKitchen();

  return (
    <div>
      <PageHeader
        eyebrow="Methods"
        title="Kitchen"
        lede="Only checked appliances and methods are offered to the planner. Add anything else you actually use."
      />
      <KitchenForm items={items} />
    </div>
  );
}
