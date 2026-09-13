import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSettings } from "@/ai/settings-repo";
import { isAdminEmail } from "@/lib/admin";
import { requirePageHousehold } from "@/lib/request-auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const { householdId } = await requirePageHousehold();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (!isAdminEmail(email)) {
    redirect("/");
  }
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
