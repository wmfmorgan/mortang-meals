export const SHOP_CHECKS_KEY = "mortang.shopChecks";

export function shopItemKey(item: { name: string; unit: string }): string {
  return `${item.name}|${item.unit}`;
}

function getLocalStorage(): Storage | null {
  try {
    const storage = globalThis.localStorage;
    return storage ?? null;
  } catch {
    return null;
  }
}

function readAll(): Record<string, string[]> {
  const storage = getLocalStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(SHOP_CHECKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, string[]> = {};
    for (const [planId, keys] of Object.entries(parsed)) {
      if (Array.isArray(keys)) {
        out[planId] = keys.filter((key) => typeof key === "string");
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function readShopChecks(planId: string): Set<string> {
  return new Set(readAll()[planId] ?? []);
}

export function writeShopChecks(planId: string, keys: Iterable<string>): void {
  const storage = getLocalStorage();
  if (!storage) return;
  const all = readAll();
  all[planId] = [...keys];
  storage.setItem(SHOP_CHECKS_KEY, JSON.stringify(all));
}

export function pruneShopChecks(
  planId: string,
  liveKeys: Iterable<string>,
): Set<string> {
  const live = new Set(liveKeys);
  const next = new Set([...readShopChecks(planId)].filter((key) => live.has(key)));
  writeShopChecks(planId, next);
  return next;
}
