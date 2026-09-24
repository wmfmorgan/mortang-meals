import { redirect } from "next/navigation";
import { acceptPendingInviteForUser } from "@/household/members-repo";
import { getHouseholdForUser } from "@/household/repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { requireUser } from "@/lib/request-auth";
import { SetupWizard } from "./setup-wizard";

export default async function SetupPage() {
  const user = await requireUser();
  if (!user.ok) redirect("/login");

  if (user.email) {
    const joined = await acceptPendingInviteForUser(user.userId, user.email);
    if (joined) redirect("/");
  }

  const household = await getHouseholdForUser(user.userId);
  if (household) {
    await seedKitchenIfEmpty(household.id);
  }
  const kitchen = household ? await listKitchen(household.id) : [];

  return <SetupWizard household={household} kitchen={kitchen} />;
}
