export type JobKind = "generate" | "import" | "library";

export function progressForPhase(
  phase: string | null,
  attempt: number | null,
): number {
  if (phase === "done") return 100;
  if (phase === "saving") return 92;
  if (phase === "writing") return 55;
  if (phase === "opening") return 22;
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

export const IMPORT_STEPS = [
  { phase: "opening", label: "Opening the page" },
  { phase: "writing", label: "Turning it into a meal" },
  { phase: "saving", label: "Saving the meal" },
] as const;

export const LIBRARY_STEPS = [
  { phase: "brief", label: "Writing the brief" },
  { phase: "calling", label: "Calling the model" },
  { phase: "validating", label: "Checking the recipes" },
  { phase: "saving", label: "Saving drafts" },
] as const;

export function stepsFor(kind: JobKind) {
  if (kind === "import") return IMPORT_STEPS;
  if (kind === "library") return LIBRARY_STEPS;
  return GENERATE_STEPS;
}

export function elapsedLabel(startedAt: number, now: number) {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function jobTitle(
  kind: JobKind,
  status: "running" | "success" | "error",
): string {
  if (kind === "import") {
    if (status === "running") return "Importing recipe";
    if (status === "success") return "Recipe saved";
    return "Import failed";
  }
  if (kind === "library") {
    if (status === "running") return "Generating library";
    if (status === "success") return "Drafts are ready";
    return "Generate failed";
  }
  if (status === "running") return "Generating this week";
  if (status === "success") return "Week ready";
  return "Generate failed";
}

export function activeStepIndex(phase: string | null, kind: JobKind = "generate"): number {
  if (kind === "import") {
    if (phase === "done") return 3;
    if (phase === "saving") return 2;
    if (phase === "writing") return 1;
    return 0;
  }
  if (kind === "library") {
    if (phase === "done") return 4;
    if (phase === "saving") return 3;
    if (phase === "validating" || phase === "retry") return 2;
    if (phase === "calling") return 1;
    return 0;
  }
  if (phase === "done") return 4;
  if (phase === "saving") return 3;
  if (phase === "validating" || phase === "retry") return 2;
  if (phase === "calling") return 1;
  return 0;
}

export function stepStatus(
  index: number,
  phase: string | null,
  generationStatus?: string | null,
  kind: JobKind = "generate",
): "done" | "current" | "pending" {
  if (generationStatus === "success" || phase === "done") return "done";
  const active = activeStepIndex(phase, kind);
  if (index < active) return "done";
  if (index === active) return "current";
  return "pending";
}
