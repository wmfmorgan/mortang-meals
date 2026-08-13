"use client";

import type { ReactNode } from "react";
import { GenerationBanner } from "./generation-banner";
import { GenerationProvider } from "./generation-provider";
import { Nav } from "./nav";

export function AppShell({
  children,
  developerTools,
}: {
  children: ReactNode;
  developerTools: boolean;
}) {
  return (
    <GenerationProvider>
      <Nav developerTools={developerTools} />
      <GenerationBanner />
      <main className="page-shell">{children}</main>
    </GenerationProvider>
  );
}
