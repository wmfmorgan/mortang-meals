"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ProviderMode, ReasoningEffort } from "@/lib/types";

export type SafeSettings = {
  mode: ProviderMode;
  baseUrl: string;
  model: string;
  customApiKey: boolean;
  developerTools: boolean;
  webSearch: boolean;
  reasoningEffort: ReasoningEffort;
  aiDailyCapEnabled: boolean;
  aiDailyCap: number;
};

const REASONING_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: "low", label: "low — faster, lighter thinking" },
  { value: "medium", label: "medium — balanced" },
  { value: "high", label: "high — deeper thinking (default)" },
  { value: "xhigh", label: "xhigh — maximum depth (grok-4.6+)" },
];

const inputClass = "input";

export function SettingsForm({ settings }: { settings: SafeSettings }) {
  const router = useRouter();
  const [mode, setMode] = useState<ProviderMode>(settings.mode);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model, setModel] = useState(settings.model);
  const [customKey, setCustomKey] = useState("");
  const [hasCustomKey, setHasCustomKey] = useState(settings.customApiKey);
  const [developerTools, setDeveloperTools] = useState(settings.developerTools);
  const [webSearch, setWebSearch] = useState(settings.webSearch);
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    settings.reasoningEffort,
  );
  const [aiDailyCapEnabled, setAiDailyCapEnabled] = useState(
    settings.aiDailyCapEnabled,
  );
  const [aiDailyCap, setAiDailyCap] = useState(String(settings.aiDailyCap));
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

  async function onToggleWebSearch(checked: boolean) {
    setWebSearch(checked);
    try {
      await putSettings({ webSearch: checked });
    } catch (error) {
      setWebSearch(!checked);
      setStatus(
        error instanceof Error ? error.message : "Couldn’t save settings.",
      );
    }
  }

  async function onChangeReasoningEffort(next: ReasoningEffort) {
    const previous = reasoningEffort;
    setReasoningEffort(next);
    try {
      await putSettings({ reasoningEffort: next });
    } catch (error) {
      setReasoningEffort(previous);
      setStatus(
        error instanceof Error ? error.message : "Couldn’t save settings.",
      );
    }
  }

  async function onToggleAiDailyCap(checked: boolean) {
    setAiDailyCapEnabled(checked);
    try {
      await putSettings({ aiDailyCapEnabled: checked });
    } catch (error) {
      setAiDailyCapEnabled(!checked);
      setStatus(
        error instanceof Error ? error.message : "Couldn’t save settings.",
      );
    }
  }

  async function onSaveAiDailyCap() {
    const parsed = Math.max(1, Math.floor(Number(aiDailyCap) || 1));
    setAiDailyCap(String(parsed));
    try {
      await putSettings({ aiDailyCap: parsed });
      setStatus("Saved daily cap.");
    } catch (error) {
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
      <label className="flex min-h-11 items-start gap-3 text-sm font-medium">
        <input
          className="mt-0.5 h-4 w-4 accent-[var(--color-olive)]"
          type="checkbox"
          checked={webSearch}
          disabled={mode !== "grok"}
          onChange={(event) => {
            void onToggleWebSearch(event.target.checked);
          }}
        />
        <span>
          Web search
          <span className="mt-1 block font-normal text-herb">
            Let Grok look up real recipes. Slower and uses more credits. Grok
            mode only.
          </span>
        </span>
      </label>
      <label className="field">
        Reasoning level
        <select
          className={inputClass}
          value={reasoningEffort}
          disabled={mode !== "grok"}
          onChange={(event) => {
            void onChangeReasoningEffort(
              event.target.value as ReasoningEffort,
            );
          }}
        >
          {REASONING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-sm font-normal text-herb">
          How hard Grok thinks before answering. Higher is slower and uses more
          tokens. Grok mode only.
        </span>
      </label>
      <label className="flex min-h-11 items-start gap-3 text-sm font-medium">
        <input
          className="mt-0.5 h-4 w-4 accent-[var(--color-olive)]"
          type="checkbox"
          checked={aiDailyCapEnabled}
          onChange={(event) => {
            void onToggleAiDailyCap(event.target.checked);
          }}
        />
        <span>
          Limit shared Grok key usage
          <span className="mt-1 block font-normal text-herb">
            Caps calls that use the server <code>XAI_API_KEY</code> (generate,
            import, swap, image backfill). Turn off to remove the limit for all
            users. Custom API keys are never capped.
          </span>
        </span>
      </label>
      <label className="field">
        Daily cap (per user, UTC day)
        <div className="flex flex-wrap items-end gap-2">
          <input
            className={inputClass}
            type="number"
            min={1}
            step={1}
            value={aiDailyCap}
            disabled={!aiDailyCapEnabled}
            onChange={(event) => setAiDailyCap(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!aiDailyCapEnabled || pending}
            onClick={() => {
              void onSaveAiDailyCap();
            }}
          >
            Save cap
          </button>
        </div>
        <span className="mt-1 block text-sm font-normal text-herb">
          Only applies when the limit above is on. Default is 10.
        </span>
      </label>
      {status ? <p className="text-sm text-herb">{status}</p> : null}
      {testMessage ? <p className="text-sm text-herb">{testMessage}</p> : null}
    </form>
  );
}
