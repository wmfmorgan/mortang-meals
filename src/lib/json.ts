/** Split concatenated JSON values (web-search tool rounds) and keep the last useful one. */
export function extractLastJsonText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    const slices = jsonSlices(trimmed);
    return pickBestJsonSlice(slices);
  }
}

function pickBestJsonSlice(slices: string[]): string | null {
  for (let i = slices.length - 1; i >= 0; i--) {
    const slice = slices[i]!;
    try {
      const value = JSON.parse(slice) as { meals?: unknown; meal?: unknown };
      if (Array.isArray(value.meals) && value.meals.length > 0) return slice;
      if (value.meal && typeof value.meal === "object") return slice;
    } catch {
      continue;
    }
  }
  return slices.at(-1) ?? null;
}

export function parseJsonValue(text: string): { ok: true; value: unknown } | { ok: false } {
  const slice = extractLastJsonText(text);
  if (slice === null) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(slice) };
  } catch {
    return { ok: false };
  }
}

function jsonSlices(text: string): string[] {
  const slices: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (start < 0) {
      if (char === "{" || char === "[") {
        start = i;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") depth += 1;
    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        slices.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return slices;
}
