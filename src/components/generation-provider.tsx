"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { JobKind } from "@/lib/generate-progress";
import type { MealSlot, SlotMask, UseIngredient } from "@/lib/types";

export type GenerationStatus = "idle" | "running" | "success" | "error";

export type GenerationState = {
  status: GenerationStatus;
  kind: JobKind;
  phase: string | null;
  message: string | null;
  attempt: number | null;
  model: string | null;
  startedAt: number | null;
  error: string | null;
};

const idleState: GenerationState = {
  status: "idle",
  kind: "generate",
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
    useIngredients?: UseIngredient[];
  }) => Promise<void>;
  startImport: (input: { url: string; slot: MealSlot }) => Promise<void>;
  cancel: () => void;
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
  | { type: "done"; planId?: string; mealId?: string }
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

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GenerationState>(idleState);
  const abortRef = useRef<AbortController | null>(null);

  const dismiss = useCallback(() => {
    setState(idleState);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(idleState);
  }, []);

  const startGenerate = useCallback(
    async (input: {
      weekStart?: string;
      slotMask: SlotMask;
      useIngredients?: UseIngredient[];
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        status: "running",
        kind: "generate",
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
            useIngredients: input.useIngredients ?? [],
          }),
          signal: controller.signal,
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
          if (controller.signal.aborted) return;
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

        if (!sawTerminal && !controller.signal.aborted) {
          setState((current) => ({
            ...current,
            status: "error",
            message: "Couldn’t get a usable plan, try again.",
            error: "Couldn’t get a usable plan, try again.",
          }));
        }
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          setState(idleState);
          return;
        }
        setState((current) => ({
          ...current,
          status: "error",
          message: "The model didn’t respond",
          error: "The model didn’t respond",
        }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [router],
  );

  const startImport = useCallback(
    async (input: { url: string; slot: MealSlot }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        status: "running",
        kind: "import",
        phase: "opening",
        message: "Starting import",
        attempt: null,
        model: null,
        startedAt: Date.now(),
        error: null,
      });

      try {
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: input.url, slot: input.slot }),
          signal: controller.signal,
        });

        if (!res.ok && !res.body) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          setState((current) => ({
            ...current,
            status: "error",
            message: data.message ?? "Couldn’t import that recipe.",
            error: data.message ?? "Couldn’t import that recipe.",
          }));
          return;
        }

        let sawTerminal = false;
        await readGenerateStream(res, (event) => {
          if (controller.signal.aborted) return;
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
              message: "Recipe is ready",
              error: null,
            }));
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

        if (!sawTerminal && !controller.signal.aborted) {
          setState((current) => ({
            ...current,
            status: "error",
            message: "Couldn’t import that recipe.",
            error: "Couldn’t import that recipe.",
          }));
        }
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          setState(idleState);
          return;
        }
        setState((current) => ({
          ...current,
          status: "error",
          message: "The model didn’t respond",
          error: "The model didn’t respond",
        }));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [router],
  );

  const value = useMemo(
    () => ({ state, startGenerate, startImport, cancel, dismiss }),
    [state, startGenerate, startImport, cancel, dismiss],
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
