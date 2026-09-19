import { normalizeImageUrl } from "./schema";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_HTML_CHARS = 400_000;

/** Pull a likely hero image URL from recipe-page HTML. */
export function extractOpenGraphImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const raw = match?.[1]?.trim();
    if (!raw) continue;
    const normalized = normalizeImageUrl(raw, true);
    if (normalized) return normalized;
  }
  return null;
}

function resolveAgainstPage(raw: string, pageUrl: string): string | null {
  try {
    return normalizeImageUrl(new URL(raw, pageUrl).href, true);
  } catch {
    return normalizeImageUrl(raw, true);
  }
}

/** Fetch a recipe page and return og/twitter image if present. */
export async function fetchPageImageUrl(
  sourceUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const page = normalizeImageUrl(sourceUrl, true);
  if (!page) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const res = await fetch(page, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "MortangMeals/1.0 (+local recipe image lookup)",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("xml")) {
      return null;
    }
    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    const extracted = extractOpenGraphImage(html);
    if (!extracted) return null;
    return resolveAgainstPage(extracted, page);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Prefer a model-provided imageUrl; if missing and we have a sourceUrl,
 * try to pull og:image from that page (web-search runs only).
 */
export async function enrichMealImageUrl<
  T extends { sourceUrl?: string | null; imageUrl?: string | null },
>(
  meal: T,
  webSearch: boolean,
  signal?: AbortSignal,
): Promise<T> {
  if (!webSearch) return meal;
  const existing = normalizeImageUrl(meal.imageUrl, true);
  if (existing) return { ...meal, imageUrl: existing };
  const sourceUrl = normalizeImageUrl(meal.sourceUrl, true);
  if (!sourceUrl) return meal;
  const fromPage = await fetchPageImageUrl(sourceUrl, signal);
  if (!fromPage) return meal;
  return { ...meal, imageUrl: fromPage };
}

export async function enrichMealsImageUrls<
  T extends { sourceUrl?: string | null; imageUrl?: string | null },
>(meals: T[], webSearch: boolean, signal?: AbortSignal): Promise<T[]> {
  if (!webSearch) return meals;
  return Promise.all(
    meals.map((meal) => enrichMealImageUrl(meal, webSearch, signal)),
  );
}
