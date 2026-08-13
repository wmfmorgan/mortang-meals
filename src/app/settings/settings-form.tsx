"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProviderMode } from "@/lib/types";

export type SafeSettings = {
  mode: ProviderMode;
  baseUrl: string;
  model: string;
  customApiKey: boolean;
  developerTools: boolean;
};

const inputClass = "input";

export function SettingsForm({ settings }: { settings: SafeSettings }) {
  const router = useRouter();
  const [mode, setMode] = useState<ProviderMode>(settings.mode);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [customKey, setCustomKey] = useState("");
  const [hasCustomKey, setHasCustomKey] = useState(settings.customApiKey);
  const [developerTools, setDeveloperTools] = useState(settings.developerTools);
  const [status, setStatus] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function putSettings(body: Record<string, unknown>) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      message?: string;
      settings?: SafeSettings;
    };
    if (!res.ok) {
      throw new Error(data.message ?? "Couldn’t save settings.");
    }
    return data.settings;
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      const body: Record<string, unknown> = { mode, baseUrl, model };
      if (customKey.trim()) body.customApiKey = customKey.trim();
      const next = await putSettings(body);
      if (next) setHasCustomKey(next.customApiKey);
      setCustomKey("");
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn’t save settings.");
    } finally {
      setPending(false);
    }
  }

  async function onClearKey() {
    setPending(true);
    setStatus(null);
    try {
      await putSettings({ customApiKey: null });
      setHasCustomKey(false);
      setCustomKey("");
      setStatus("Key cleared.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn’t clear key.");
    } finally {
      setPending(false);
    }
  }

  async function onToggleDeveloper(checked: boolean) {
    setDeveloperTools(checked);
    try {
      await putSettings({ developerTools: checked });
      router.refresh();
    } catch (error) {
      setDeveloperTools(!checked);
      setStatus(
        error instanceof Error ? error.message : "Couldn’t save settings.",
      );
    }
  }

  async function onTest() {
    setPending(true);
    setTestMessage(null);
    try {
      const res = await fetch("/api/settings/test", { method: "POST" });
      const data = (await res.json()) as { message?: string };
      setTestMessage(data.message ?? "No message.");
    } catch {
      setTestMessage("The model didn’t respond");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="surface max-w-xl space-y-5 p-6" onSubmit={onSave}>
      <label className="field">
        Mode
        <select
          className={inputClass}
          value={mode}
          onChange={(event) => setMode(event.target.value as ProviderMode)}
        >
          <option value="grok">grok</option>
          <option value="custom">custom</option>
        </select>
      </label>
      <label className="field">
        Base URL
        <input
          className={inputClass}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </label>
      <label className="field">
        Model
        <input
          className={inputClass}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        />
      </label>
      <label className="field">
        Custom API key
        <input
          className={inputClass}
          type="password"
          value={customKey}
          onChange={(event) => setCustomKey(event.target.value)}
          placeholder={hasCustomKey ? "leave blank to keep" : undefined}
          autoComplete="off"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Save
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending || !hasCustomKey}
          onClick={() => {
            void onClearKey();
          }}
        >
          Clear key
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => {
            void onTest();
          }}
        >
          Test connection
        </button>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input
          className="h-4 w-4 accent-[var(--color-olive)]"
          type="checkbox"
          checked={developerTools}
          onChange={(event) => {
            void onToggleDeveloper(event.target.checked);
          }}
        />
        Developer tools
      </label>
      {status ? <p className="text-sm text-herb">{status}</p> : null}
      {testMessage ? <p className="text-sm text-herb">{testMessage}</p> : null}
    </form>
  );
}
