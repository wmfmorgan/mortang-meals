export function progressForPhase(
  phase: string | null,
  attempt: number | null,
): number {
  if (phase === "done") return 100;
  if (phase === "saving") return 92;
  if (phase === "validating") return attempt === 2 ? 86 : 68;
  if (phase === "retry") return 58;
  if (phase === "calling") return attempt === 2 ? 76 : 38;
  if (phase === "brief") return 14;
  return 6;
}

export const GENERATE_STEPS = [
  { phase: "brief", label: "Writing the brief" },
  { phase: "calling", label: "Calling the model" },
  { phase: "validating", label: "Checking the plan" },
  { phase: "saving", label: "Saving the week" },
] as const;

export function activeStepIndex(phase: string | null): number {
  if (phase === "done" || phase === "saving") return 3;
  if (phase === "validating" || phase === "retry") return 2;
  if (phase === "calling") return 1;
  return 0;
}
