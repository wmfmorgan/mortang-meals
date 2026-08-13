import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { KitchenForm } from "./kitchen-form";

export default function KitchenPage() {
  seedKitchenIfEmpty();
  const items = listKitchen();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Kitchen</h1>
      <KitchenForm items={items} />
    </div>
  );
}
