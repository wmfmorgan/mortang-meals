import { PageHeader } from "@/components/page-header";
import { getSettings } from "@/ai/settings-repo";
import { listTraces } from "@/ai/traces";
import { DeveloperLog } from "./developer-log";
import { canViewDeveloper } from "./visibility";

export default function DeveloperPage() {
  const settings = getSettings();
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

  const traces = listTraces();

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
