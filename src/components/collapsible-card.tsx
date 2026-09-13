"use client";

import { useId, useState, type ReactNode } from "react";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={
        open ? "collapsible-chevron is-open" : "collapsible-chevron"
      }
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

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
        tone === "card"
          ? "surface overflow-hidden"
          : open
            ? "space-y-3"
            : "collapsible-section is-collapsed space-y-3"
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
        aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="collapsible-toggle-label">
          <ChevronIcon open={open} />
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
