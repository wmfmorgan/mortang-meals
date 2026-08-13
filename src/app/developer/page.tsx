import { getSettings } from "@/ai/settings-repo";
import { listTraces } from "@/ai/traces";
import { DeveloperLog } from "./developer-log";
import { canViewDeveloper } from "./visibility";

export default function DeveloperPage() {
  const settings = getSettings();
  if (!canViewDeveloper(settings.developerTools)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Developer</h1>
        <p>Turn on Developer tools in Settings</p>
      </div>
    );
  }

  const traces = listTraces();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Developer</h1>
      <DeveloperLog traces={traces} />
    </div>
  );
}
