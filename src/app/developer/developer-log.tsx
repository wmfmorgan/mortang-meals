"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiTrace } from "@/lib/types";

export function DeveloperLog({
  traces,
  missingImages = 0,
}: {
  traces: AiTrace[];
  missingImages?: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [backfillPending, setBackfillPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onClear() {
    setPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/traces", { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setStatus(data.message ?? "Couldn’t clear log.");
        return;
      }
      router.refresh();
    } catch {
      setStatus("Couldn’t clear log.");
    } finally {
      setPending(false);
    }
  }

  async function onBackfillImages() {
    setBackfillPending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/library/backfill-images", {
        method: "POST",
      });
      const data = (await res.json()) as { message?: string };
      setStatus(data.message ?? (res.ok ? "Done." : "Backfill failed."));
      router.refresh();
    } catch {
      setStatus("Couldn’t backfill meal images.");
    } finally {
      setBackfillPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => {
            void onClear();
          }}
        >
          Clear log
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={backfillPending || missingImages === 0}
          onClick={() => {
            void onBackfillImages();
          }}
        >
          {backfillPending
            ? "Finding pictures…"
            : missingImages === 0
              ? "Meal images filled"
              : `Backfill meal images (${missingImages})`}
        </button>
      </div>
      {status ? <p className="text-sm text-herb">{status}</p> : null}
      {traces.length === 0 ? (
        <p className="page-lede">No traces yet.</p>
      ) : (
        <ul className="space-y-3">
          {traces.map((trace) => (
            <li key={trace.id} className="surface p-4">
              <details>
                <summary className="cursor-pointer font-medium tracking-[-0.02em]">
                  {trace.createdAt} · {trace.kind} · {trace.model} ·{" "}
                  {trace.validation}
                </summary>
                <p className="mt-2 font-mono text-[0.75rem] text-herb">
                  {trace.mode} · {trace.baseUrl}
                </p>
                <h3 className="page-eyebrow mt-4">requestText</h3>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-linen p-3 font-mono text-[0.78rem] leading-relaxed">
                  {trace.requestText}
                </pre>
                <h3 className="page-eyebrow mt-4">responseText</h3>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-linen p-3 font-mono text-[0.78rem] leading-relaxed">
                  {trace.responseText}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
