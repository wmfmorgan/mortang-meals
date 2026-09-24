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
      {
        name: "garlic",
        quantity: "4",
        unit: "clove",
        aisle: "produce" as const,
        sources: [] as string[],
      },
    ],
  },
];

const maya = {
  id: "maya",
  name: "Maya",
  age: 8,
  sex: null,
  allergies: ["soy"],
  avoidances: ["gluten"],
};

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

  it("updates batch progress when an item is checked", () => {
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={groups}
      />,
    );
    expect(screen.getByText(/0 of 1 items marked gathered/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText(/1 of 1 items marked gathered/i)).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("hides allergen rows when Safe for a person is selected", () => {
    const soyGroups = [
      {
        aisle: "pantry" as const,
        items: [
          {
            name: "soy sauce",
            quantity: "1",
            unit: "tbsp",
            aisle: "pantry" as const,
            sources: [] as string[],
          },
          {
            name: "rice",
            quantity: "1",
            unit: "cup",
            aisle: "pantry" as const,
            sources: [] as string[],
          },
        ],
      },
    ];
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={soyGroups}
        people={[maya]}
      />,
    );
    expect(screen.getByText(/soy sauce/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Safe for Maya/i }));
    expect(screen.queryByText(/soy sauce/i)).toBeNull();
    expect(screen.getByText(/rice/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /All household/i }));
    expect(screen.getByText(/soy sauce/i)).toBeTruthy();
  });

  it("shows allergy and source chips on a row", () => {
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={[
          {
            aisle: "pantry",
            items: [
              {
                name: "soy sauce",
                quantity: "1",
                unit: "tbsp",
                aisle: "pantry",
                sources: ["Sheet Pan Miso Salmon"],
              },
            ],
          },
        ]}
        people={[maya]}
      />,
    );
    expect(screen.getByText("Maya · soy")).toBeTruthy();
    expect(screen.getByText("Sheet Pan Miso Salmon")).toBeTruthy();
  });

  it("lists household people in the dietary guards sidebar", () => {
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={groups}
        people={[maya]}
      />,
    );
    expect(screen.getByRole("heading", { name: /Household dietary guards/i })).toBeTruthy();
    expect(screen.getByText("Maya")).toBeTruthy();
    expect(screen.getByText("soy")).toBeTruthy();
    expect(screen.getByText("gluten")).toBeTruthy();
  });

  it("does not show Safe-for filters when nobody has allergies", () => {
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={groups}
        people={[{ ...maya, allergies: [] }]}
      />,
    );
    expect(screen.queryByRole("button", { name: /All household/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Safe for Maya/i })).toBeNull();
  });

  it("asks to fill the plan when the list is empty", () => {
    render(
      <ShoppingListView
        planId="plan-a"
        weekLabel="Aug 31-Sep 6, 2026"
        groups={[]}
      />,
    );
    expect(
      screen.getByText("Fill the plan to build a shopping list."),
    ).toBeTruthy();
    expect(screen.queryByText(/items marked gathered/i)).toBeNull();
  });
});
