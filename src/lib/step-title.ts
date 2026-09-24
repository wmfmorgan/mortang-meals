export function stepChipTitle(step: string, index: number): string {
  const words = step.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const body = words.length ? words.join(" ") : "Step";
  return `${index + 1}. ${body}`;
}
