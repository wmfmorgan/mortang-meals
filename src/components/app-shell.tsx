"use client";

import type { ReactNode } from "react";
import { GenerationProvider } from "./generation-provider";
import { Nav } from "./nav";

function ShellBody({
  children,
  developerTools,
}: {
  children: ReactNode;
  developerTools: boolean;
}) {
  return (
    <>
      <Nav developerTools={developerTools} />
      <main className="page-shell">{children}</main>
    </>
  );
}

export function AppShell({
  children,
  developerTools,
}: {
  children: ReactNode;
  developerTools: boolean;
}) {
  return (
    <GenerationProvider>
      <ShellBody developerTools={developerTools}>{children}</ShellBody>
    </GenerationProvider>
  );
}
