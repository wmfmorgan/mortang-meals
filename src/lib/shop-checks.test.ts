import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  pruneShopChecks,
  readShopChecks,
  shopItemKey,
  writeShopChecks,
} from "./shop-checks";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage(),
    configurable: true,
  });
});

afterEach(() => {
  globalThis.localStorage.clear();
});

describe("shop checks", () => {
  it("round-trips checks per plan", () => {
    writeShopChecks("plan-a", ["garlic|clove"]);
    writeShopChecks("plan-b", ["salmon|lb"]);
    expect([...readShopChecks("plan-a")]).toEqual(["garlic|clove"]);
    expect([...readShopChecks("plan-b")]).toEqual(["salmon|lb"]);
  });

  it("drops keys that are no longer on the list", () => {
    writeShopChecks("plan-a", ["garlic|clove", "old|cup"]);
    const next = pruneShopChecks("plan-a", ["garlic|clove"]);
    expect([...next]).toEqual(["garlic|clove"]);
    expect([...readShopChecks("plan-a")]).toEqual(["garlic|clove"]);
  });

  it("builds a stable item key", () => {
    expect(shopItemKey({ name: "garlic", unit: "clove" })).toBe("garlic|clove");
  });
});
