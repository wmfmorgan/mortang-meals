"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { SlotMask } from "@/lib/types";

export type GenerationStatus = "idle" | "running" | "success" | "error";

export type GenerationState = {
  status: GenerationStatus;
  phase: string | null;
  message: string | null;
  attempt: number | null;
  model: string | null;
  startedAt: number | null;
  error: string | null;
};

const idleState: GenerationState = {
  status: "idle",
  phase: null,
  message: null,
  attempt: null,
  model: null,
  startedAt: null,
  error: null,
};

type GenerationContextValue = {
  state: GenerationState;
  startGenerate: (input: {
    weekStart?: string;
    slotMask: SlotMask;
  }) => Promise<void>;
  dismiss: () => void;
};

const GenerationContext = createContext<GenerationContextValue | null>(null);

type StreamEvent =
  | {
      type: "progress";
      phase: string;
      message: string;
      attempt?: number;
      model?: string;
    }
  | { type: "done"; planId: string }
  | { type: "error"; status: number; message: string };

async function readGenerateStream(
  response: Response,
  onEvent: (event: StreamEvent) => void,
) {
  if (!response.body) {
    throw new Error("The model didn’t respond");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      onEvent(JSON.parse(trimmed) as StreamEvent);
    }
    if (done) break;
  }
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GenerationState>(idleState);

  const dismiss = useCallback(() => {
    setState(idleState);
  }, []);

  const startGenerate = useCallback(
    async (input: { weekStart?: string; slotMask: SlotMask }) => {
      setState({
        status: "running",
        phase: "brief",
        message: "Starting generate",
        attempt: 1,
        model: null,
        startedAt: Date.now(),
        error: null,
      });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(input.weekStart ? { weekStart: input.weekStart } : {}),
            slotMask: input.slotMask,
          }),
        });

        if (!res.ok && !res.body) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          setState((current) => ({
            ...current,
            status: "error",
            message: data.message ?? "Couldn’t get a usable plan, try again.",
            error: data.message ?? "Couldn’t get a usable plan, try again.",
          }));
          return;
        }

        let sawTerminal = false;
        await readGenerateStream(res, (event) => {
          if (event.type === "progress") {
            setState((current) => ({
              ...current,
              status: "running",
              phase: event.phase,
              message: event.message,
              attempt: event.attempt ?? current.attempt,
              model: event.model ?? current.model,
            }));
            return;
          }
          if (event.type === "done") {
            sawTerminal = true;
            setState((current) => ({
              ...current,
              status: "success",
              phase: "done",
              message: "Week is ready",
              error: null,
            }));
            router.push("/");
            router.refresh();
            return;
          }
          sawTerminal = true;
          setState((current) => ({
            ...current,
            status: "error",
            phase: "error",
            message: event.message,
            error: event.message,
          }));
        });

        if (!sawTerminal) {
          setState((current) => ({
            ...current,
            status: "error",
            message: "Couldn’t get a usable plan, try again.",
            error: "Couldn’t get a usable plan, try again.",
          }));
        }
      } catch {
        setState((current) => ({
          ...current,
          status: "error",
          message: "The model didn’t respond",
          error: "The model didn’t respond",
        }));
      }
    },
    [router],
  );

  const value = useMemo(
    () => ({ state, startGenerate, dismiss }),
    [state, startGenerate, dismiss],
  );

  return (
    <GenerationContext.Provider value={value}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  const value = useContext(GenerationContext);
  if (!value) {
    throw new Error("useGeneration must be used within GenerationProvider");
  }
  return value;
}
