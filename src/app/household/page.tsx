import { PageHeader } from "@/components/page-header";
import { requirePageHousehold } from "@/lib/request-auth";
import { HouseholdForm } from "./household-form";

export default async function HouseholdPage() {
  const { household } = await requirePageHousehold();

  return (
    <div>
      <PageHeader
        eyebrow="Profiles"
        title="Household"
        lede="Who you cook for: names, allergies, avoidances, and notes."
      />
      <HouseholdForm household={household} />
    </div>
  );
}
