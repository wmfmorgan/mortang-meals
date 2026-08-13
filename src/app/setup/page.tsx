import { getHousehold } from "@/household/repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { SetupWizard } from "./setup-wizard";

export default function SetupPage() {
  seedKitchenIfEmpty();
  const household = getHousehold();
  const kitchen = listKitchen();

  return <SetupWizard household={household} kitchen={kitchen} />;
}
