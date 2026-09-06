// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { MealsCatalog } from "./meals-catalog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("./generation-provider", () => ({
  useGeneration: () => ({
    state: { status: "idle", kind: "import" },
    startImport: vi.fn(),
    startLibrary: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ prefs: null }),
    }),
  );
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
  extras: EMPTY_EXTRAS,
  draft: false,
  stars: 0,
  takeout: false,
  leftover: false,
};

describe("MealsCatalog", () => {
  it("links to the add-recipe page", () => {
    render(
      <MealsCatalog meals={[meal]} servings={2} currentPlanId={null} />,
    );
    expect(
      screen.getByRole("link", { name: "Add recipe" }).getAttribute("href"),
    ).toBe("/meals/new");
  });

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

  it("puts generate, drafts, then the saved catalog on the meals page", () => {
    const draft: Meal = {
      ...meal,
      id: "draft-chili",
      title: "Draft chili",
      sourceUrl: null,
      draft: true,
    };
    render(
      <MealsCatalog
        meals={[meal]}
        drafts={[draft]}
        people={[
          {
            id: "p1",
            name: "Alex",
            age: 40,
            sex: "male",
            allergies: [],
            avoidances: [],
          },
        ]}
        servings={2}
        currentPlanId={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "Generate library" })).toBeTruthy();
    expect(screen.getByText("Review before they join the library")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(screen.getByText("Draft chili")).toBeTruthy();
    expect(screen.getByRole("button", { name: "4 stars" })).toBeTruthy();
  });
});
