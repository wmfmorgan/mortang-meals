"use client";

import type { ReactNode } from "react";
import { GenerationProvider } from "./generation-provider";
import { Nav } from "./nav";

function ShellBody({
  children,
  developerTools,
  userEmail,
}: {
  children: ReactNode;
  developerTools: boolean;
  userEmail?: string | null;
}) {
  return (
    <>
      <Nav developerTools={developerTools} userEmail={userEmail} />
      <main className="page-shell">{children}</main>
    </>
  );
}

export function AppShell({
  children,
  developerTools,
  userEmail,
}: {
  children: ReactNode;
  developerTools: boolean;
  userEmail?: string | null;
}) {
  return (
    <GenerationProvider>
      <ShellBody developerTools={developerTools} userEmail={userEmail}>
        {children}
      </ShellBody>
    </GenerationProvider>
  );
}
