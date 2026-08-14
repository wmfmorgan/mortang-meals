// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
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
};

describe("RecipeFlyout", () => {
  it("links details through to the full recipe page", () => {
    render(<RecipeFlyout meal={meal} servings={2} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /open full recipe/i });
    expect(link.getAttribute("href")).toBe("/meals/meal-salmon");
    expect(screen.getByText("salmon")).toBeTruthy();
  });
});
