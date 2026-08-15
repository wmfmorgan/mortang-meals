// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { MealsCatalog } from "./meals-catalog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("./generation-provider", () => ({
  useGeneration: () => ({
    state: { status: "idle", kind: "import" },
    startImport: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

const meal: Meal = {
  id: "meal-salmon",
  planId: "",
  day: "monday",
  slot: "dinner",
  title: "Lemon herb salmon",
  whyItFits: "High-protein",
  cookMinutes: 30,
  method: "sheet pan",
  ingredients: [{ name: "salmon", quantity: "1", unit: "lb", aisle: "meat" }],
  steps: ["Roast"],
  usedWebSearch: false,
  pinned: false,
  createdAt: "2026-08-10T12:00:00.000Z",
  sourceUrl: "https://example.com/salmon",
};

describe("MealsCatalog", () => {
  it("opens the recipe flyout instead of linking the card to the detail page", () => {
    render(
      <MealsCatalog meals={[meal]} servings={2} currentPlanId={null} />,
    );

    expect(
      screen.queryByRole("link", { name: /lemon herb salmon/i }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /lemon herb salmon/i }));
    expect(screen.getByRole("dialog", { name: /lemon herb salmon/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /open full recipe/i }).getAttribute("href")).toBe(
      "/meals/meal-salmon",
    );
    expect(screen.getAllByText("Imported from a URL").length).toBeGreaterThan(0);
  });

  it("offers a none grouping option", () => {
    render(
      <MealsCatalog meals={[meal]} servings={2} currentPlanId={null} />,
    );
    expect(screen.getByRole("option", { name: "none" })).toBeTruthy();
  });
});
