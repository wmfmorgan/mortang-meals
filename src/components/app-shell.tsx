"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GenerationBanner } from "./generation-banner";
import { GenerationModal } from "./generation-modal";
import { GenerationProvider, useGeneration } from "./generation-provider";
import { Nav } from "./nav";

function ShellBody({
  children,
  developerTools,
}: {
  children: ReactNode;
  developerTools: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const { state } = useGeneration();
  const onThisWeek = pathname === "/";
  const showModal = onThisWeek && state.status !== "idle";
  const showBanner = !onThisWeek && state.status !== "idle";

  return (
    <>
      <Nav developerTools={developerTools} />
      {showBanner ? <GenerationBanner /> : null}
      <main className="page-shell">{children}</main>
      {showModal ? <GenerationModal /> : null}
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
