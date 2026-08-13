"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiTrace } from "@/lib/types";

export function DeveloperLog({ traces }: { traces: AiTrace[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
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

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="rounded border border-zinc-400 bg-white px-3 py-1 disabled:opacity-50"
        disabled={pending}
        onClick={() => {
          void onClear();
        }}
      >
        Clear log
      </button>
      {status ? <p>{status}</p> : null}
      {traces.length === 0 ? (
        <p>No traces yet.</p>
      ) : (
        <ul className="space-y-3">
          {traces.map((trace) => (
            <li key={trace.id} className="rounded border border-zinc-300 bg-white p-3">
              <details>
                <summary className="cursor-pointer font-medium">
                  {trace.createdAt} · {trace.kind} · {trace.model} ·{" "}
                  {trace.validation}
                </summary>
                <p className="mt-2 text-sm text-zinc-600">
                  {trace.mode} · {trace.baseUrl}
                </p>
                <h3 className="mt-3 text-sm font-medium">requestText</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 text-sm">
                  {trace.requestText}
                </pre>
                <h3 className="mt-3 text-sm font-medium">responseText</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-2 text-sm">
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
