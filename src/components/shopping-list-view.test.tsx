// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readShopChecks } from "@/lib/shop-checks";
import { ShoppingListView } from "./shopping-list-view";

vi.mock("@/meals/shopping-list-pdf", () => ({
  shoppingListPdf: vi.fn(async () => new Blob(["%PDF-"], { type: "application/pdf" })),
  shoppingListPdfFilename: (weekLabel: string) => `list-${weekLabel}.pdf`,
}));

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
  cleanup();
  vi.unstubAllGlobals();
});

const groups = [
  {
    aisle: "produce" as const,
    items: [
      { name: "garlic", quantity: "4", unit: "clove", aisle: "produce" as const },
    ],
  },
];

describe("ShoppingListView", () => {
  it("checks an item and keeps it for that plan", () => {
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={groups}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(readShopChecks("plan-a").has("garlic|clove")).toBe(true);
  });

  it("does not show a stored key that is no longer on the list", async () => {
    globalThis.localStorage.setItem(
      "mortang.shopChecks",
      JSON.stringify({ "plan-a": ["ghost|cup", "garlic|clove"] }),
    );
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={groups}
      />,
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    await vi.waitFor(() => {
      expect(readShopChecks("plan-a").has("ghost|cup")).toBe(false);
    });
  });

  it("prints by opening a PDF", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={groups}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Print shopping list" }));
    await vi.waitFor(() => {
      expect(open).toHaveBeenCalled();
    });
    open.mockRestore();
  });

  it("shares a PDF when the browser can share files", async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      ...navigator,
      share,
      canShare: () => true,
    });
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={groups}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share shopping list" }));
    await vi.waitFor(() => {
      expect(share).toHaveBeenCalled();
    });
  });
});
