import { getHousehold } from "@/household/repo";
import { HouseholdForm } from "./household-form";

export default function HouseholdPage() {
  const household = getHousehold();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Household</h1>
      {household && !household.dietStyle.trim() ? (
        <p>Add a diet style before generating.</p>
      ) : null}
      <HouseholdForm household={household} />
    </div>
  );
}
