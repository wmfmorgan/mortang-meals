// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { RecipeFlyout } from "./recipe-flyout";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

const meal: Meal = {
  id: "meal-salmon",
  planId: "plan-1",
  day: "monday",
  slot: "dinner",
  title: "Lemon herb salmon",
  whyItFits: "High-protein Mediterranean",
  cookMinutes: 35,
  method: "sheet pan",
  ingredients: [{ name: "salmon", quantity: "1", unit: "lb", aisle: "meat" }],
  steps: ["Roast"],
  usedWebSearch: false,
  pinned: false,
  createdAt: "2026-08-10T12:00:00.000Z",
  sourceUrl: null,
  extras: EMPTY_EXTRAS,
};

describe("RecipeFlyout", () => {
  it("links details through to the full recipe page", () => {
    render(<RecipeFlyout meal={meal} servings={2} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /open full recipe/i });
    expect(link.getAttribute("href")).toBe("/meals/meal-salmon");
    expect(screen.getByText("salmon")).toBeTruthy();
    expect(screen.queryByText("Found with web search")).toBeNull();
  });

  it("shows a star when the meal was generated with web search", () => {
    render(
      <RecipeFlyout
        meal={{ ...meal, usedWebSearch: true }}
        servings={2}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Found with web search")).toBeTruthy();
  });

  it("shows an import icon and source link for imported meals", () => {
    render(
      <RecipeFlyout
        meal={{
          ...meal,
          planId: "",
          sourceUrl: "https://example.com/salmon",
          usedWebSearch: true,
        }}
        servings={2}
        onClose={() => {}}
        canSwap={false}
      />,
    );
    expect(screen.getByText("Imported from a URL")).toBeTruthy();
    const source = screen.getByRole("link", {
      name: "https://example.com/salmon",
    });
    expect(source.getAttribute("href")).toBe("https://example.com/salmon");
    expect(screen.queryByRole("button", { name: /regenerate meal/i })).toBeNull();
  });

  it("shows a source link on a web-search meal that cites a page", () => {
    render(
      <RecipeFlyout
        meal={{
          ...meal,
          usedWebSearch: true,
          sourceUrl: "https://example.com/week-salmon",
        }}
        servings={2}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Found with web search")).toBeTruthy();
    const source = screen.getByRole("link", {
      name: "https://example.com/week-salmon",
    });
    expect(source.getAttribute("href")).toBe("https://example.com/week-salmon");
  });

  it("renders two ingredients that share a name and unit", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <RecipeFlyout
        meal={{
          ...meal,
          ingredients: [
            { name: "butter", quantity: "1", unit: "tablespoon", aisle: "dairy" },
            { name: "butter", quantity: "2", unit: "tablespoon", aisle: "dairy" },
          ],
        }}
        servings={2}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("1 tablespoon")).toBeTruthy();
    expect(screen.getByText("2 tablespoon")).toBeTruthy();
    expect(
      error.mock.calls.some((call) =>
        call.some(
          (arg) =>
            typeof arg === "string" && arg.includes("same key"),
        ),
      ),
    ).toBe(false);
    error.mockRestore();
  });

  it("can hide the full recipe link for extras", () => {
    render(
      <RecipeFlyout
        meal={meal}
        servings={2}
        onClose={() => {}}
        canSwap={false}
        showOpenFullRecipe={false}
      />,
    );
    expect(screen.queryByRole("link", { name: /open full recipe/i })).toBeNull();
  });
});
