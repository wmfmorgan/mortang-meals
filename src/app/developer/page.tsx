import { PageHeader } from "@/components/page-header";
import { getSettings } from "@/ai/settings-repo";
import { listTraces } from "@/ai/traces";
import { requirePageHousehold } from "@/lib/request-auth";
import { DeveloperLog } from "./developer-log";
import { canViewDeveloper } from "./visibility";

export default async function DeveloperPage() {
  const { householdId } = await requirePageHousehold();
  const settings = await getSettings(householdId);
  if (!canViewDeveloper(settings.developerTools)) {
    return (
      <div>
        <PageHeader
          eyebrow="Log"
          title="Developer"
          lede="Turn on Developer tools in Settings"
        />
      </div>
    );
  }

  const traces = await listTraces(householdId);

  return (
    <div>
      <PageHeader
        eyebrow="Log"
        title="Developer"
        lede="The last twenty-five prompts and replies. Keys are stripped before anything is stored."
      />
      <DeveloperLog traces={traces} />
    </div>
  );
}
