"use client";

import { useId, useState, type ReactNode } from "react";

export function CollapsibleCard({
  title,
  children,
  defaultOpen = false,
  tone = "card",
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** `card` = surface panel; `section` = catalog group heading. */
  tone?: "card" | "section";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={
        tone === "card" ? "surface overflow-hidden" : "space-y-3"
      }
    >
      <button
        type="button"
        className={
          tone === "card"
            ? "collapsible-card-toggle"
            : "collapsible-section-toggle"
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={
            tone === "card"
              ? "text-xl font-medium tracking-[-0.03em]"
              : "page-eyebrow"
          }
          style={tone === "section" ? { margin: 0 } : undefined}
        >
          {title}
        </span>
        <span className="collapsible-card-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          className={
            tone === "card"
              ? "space-y-4 border-t border-wheat p-5"
              : undefined
          }
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
