import type { ReactNode } from "react";
import { Geist_Mono, Outfit } from "next/font/google";
import { getSettings } from "@/ai/settings-repo";
import { AppShell } from "@/components/app-shell";
import { getHouseholdForUser } from "@/household/repo";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const dynamic = "force-dynamic";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
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
    <html lang="en" className={`${outfit.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-linen font-sans text-ink">
        <AppShell developerTools={developerTools} userEmail={userEmail}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
