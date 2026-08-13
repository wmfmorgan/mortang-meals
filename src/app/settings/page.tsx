import { getSettings } from "@/ai/settings-repo";
import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
  const settings = getSettings();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsForm
        settings={{
          mode: settings.mode,
          baseUrl: settings.baseUrl,
          model: settings.model,
          customApiKey:
            settings.customApiKey != null && settings.customApiKey.length > 0,
          developerTools: settings.developerTools,
        }}
      />
    </div>
  );
}
