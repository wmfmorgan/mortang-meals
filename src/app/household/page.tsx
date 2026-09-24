import { PageHeader } from "@/components/page-header";
import { listInvites, listMembers } from "@/household/members-repo";
import { getKitchenPrefs } from "@/kitchen/prefs-repo";
import { listKitchen, seedKitchenIfEmpty } from "@/kitchen/repo";
import { requirePageHousehold } from "@/lib/request-auth";
import { HouseholdKitchenForm } from "./household-kitchen-form";
import { HouseholdMembers } from "./household-members";

export default async function HouseholdPage() {
  const { household, householdId, userId } = await requirePageHousehold();
  await seedKitchenIfEmpty(householdId);
  const items = await listKitchen(householdId);
  const prefs = await getKitchenPrefs(householdId);
  const members = await listMembers(householdId);
  const invites = await listInvites(householdId);
  const isOwner =
    members.find((member) => member.userId === userId)?.role === "owner";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profiles"
        title="Household & Dietary Preferences"
        lede="Who you cook for, how you cook, and which appliances library generate may use."
      />
      <HouseholdMembers
        members={members}
        invites={invites.map((invite) => ({
          id: invite.id,
          code: invite.code,
          invitedEmail: invite.invitedEmail,
          expiresAt: invite.expiresAt.toISOString(),
          useCount: invite.useCount,
          maxUses: invite.maxUses,
          revokedAt: invite.revokedAt?.toISOString() ?? null,
          createdAt: invite.createdAt.toISOString(),
        }))}
        isOwner={isOwner}
        currentUserId={userId}
      />
      <HouseholdKitchenForm
        household={household}
        items={items}
        prefs={prefs}
      />
    </div>
  );
}
