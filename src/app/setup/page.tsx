import { getHouseholdForUser } from "@/household/repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { requirePageUser } from "@/lib/request-auth";
import { SetupWizard } from "./setup-wizard";

export default async function SetupPage() {
  const userId = await requirePageUser();
  const household = await getHouseholdForUser(userId);
  if (household) {
    await seedKitchenIfEmpty(household.id);
  }
  const kitchen = household ? await listKitchen(household.id) : [];

  return <SetupWizard household={household} kitchen={kitchen} />;
}
