import type { ReactNode } from "react";
import { Geist_Mono, Outfit } from "next/font/google";
import { getSettings } from "@/ai/settings-repo";
import { AppShell } from "@/components/app-shell";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  const settings = getSettings();

  return (
    <html lang="en" className={`${outfit.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-linen font-sans text-ink">
        <AppShell developerTools={settings.developerTools}>{children}</AppShell>
      </body>
    </html>
  );
}
