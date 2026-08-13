import { redirect } from "next/navigation";
import { getHousehold } from "@/household/repo";

export default function HomePage() {
  const household = getHousehold();
  if (!household || household.people.length === 0) {
    redirect("/setup");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">This Week</h1>
      {!household.dietStyle.trim() ? (
        <p>Add a diet style before generating.</p>
      ) : null}
    </div>
  );
}
