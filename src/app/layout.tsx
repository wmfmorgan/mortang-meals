import type { ReactNode } from "react";
import { getSettings } from "@/ai/settings-repo";
import { Nav } from "@/components/nav";
import { getHousehold } from "@/household/repo";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mortang Meals",
  description: "Local household meal planner",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const settings = getSettings();
  getHousehold();

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <Nav developerTools={settings.developerTools} />
        <main className="mx-auto max-w-4xl p-4">{children}</main>
      </body>
    </html>
  );
}
