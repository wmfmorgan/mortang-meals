export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDuplicateTitle(candidate: string, taken: string[]): boolean {
  return taken.some((t) => normalizeTitle(t) === normalizeTitle(candidate));
}
