"use client";

import { useId, useState, type ReactNode } from "react";

export function CollapsibleCard({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        className="collapsible-card-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-xl font-medium tracking-[-0.03em]">{title}</span>
        <span className="collapsible-card-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="space-y-4 border-t border-wheat p-5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
