import { PageHeader } from "@/components/page-header";
import { getSettings } from "@/ai/settings-repo";
import { requirePageHousehold } from "@/lib/request-auth";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { householdId } = await requirePageHousehold();
  const settings = await getSettings(householdId);

  return (
    <div>
      <PageHeader
        eyebrow="Provider"
        title="Settings"
        lede="Grok by default. Point at any OpenAI-compatible local server when you want the kitchen offline."
      />
      <SettingsForm
        settings={{
          mode: settings.mode,
          baseUrl: settings.baseUrl,
          model: settings.model,
          customApiKey:
            settings.customApiKey != null && settings.customApiKey.length > 0,
          developerTools: settings.developerTools,
          webSearch: settings.webSearch,
        }}
      />
    </div>
  );
}
