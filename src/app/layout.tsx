import type { ReactNode } from "react";
import { Geist, Space_Grotesk } from "next/font/google";
import { getSettings } from "@/ai/settings-repo";
import { AppShell } from "@/components/app-shell";
import { getHouseholdForUser } from "@/household/repo";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const dynamic = "force-dynamic";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

export const metadata = {
  title: "Mortang Meals",
  description: "Local household meal planner",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let userEmail: string | null = null;
  let developerTools = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const userId = claims?.sub;
    if (typeof claims?.email === "string") {
      userEmail = claims.email;
    }
    if (typeof userId === "string") {
      const household = await getHouseholdForUser(userId);
      if (household) {
        const settings = await getSettings(household.id);
        developerTools = settings.developerTools;
      }
    }
  } catch {
    developerTools = false;
  }

  return (
    <html lang="en" className={`${geist.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-dvh bg-linen font-sans text-ink">
        <AppShell developerTools={developerTools} userEmail={userEmail}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
