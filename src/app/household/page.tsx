import { PageHeader } from "@/components/page-header";
import { getHousehold } from "@/household/repo";
import { HouseholdForm } from "./household-form";

export default function HouseholdPage() {
  const household = getHousehold();

  return (
    <div>
      <PageHeader
        eyebrow="Profiles"
        title="Household"
        lede="Shared diet, personal allergies and avoidances. This is what the planner reads before it writes a week."
      />
      {household && !household.dietStyle.trim() ? (
        <p className="mb-4 text-sm text-herb">Add a diet style before generating.</p>
      ) : null}
      <HouseholdForm household={household} />
    </div>
  );
}
