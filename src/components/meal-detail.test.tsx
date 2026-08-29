// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { MealDetail } from "./meal-detail";

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
  steps: ["Roast until the flesh flakes"],
  usedWebSearch: false,
  pinned: false,
  createdAt: "2026-08-10T12:00:00.000Z",
  sourceUrl: null,
};

function renderDetail(overrides: Partial<ComponentProps<typeof MealDetail>> = {}) {
  return render(
    <MealDetail
      meal={meal}
      servings="Serves 4"
      canSwap={false}
      eyebrow="Monday dinner"
      {...overrides}
    />,
  );
}

describe("MealDetail print", () => {
  it("shows a Print recipe control on the recipe page", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: "Print recipe" })).toBeTruthy();
  });

  it("opens the browser print dialog", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderDetail();
    screen.getByRole("button", { name: "Print recipe" }).click();
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it("hides the print control while editing", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: "Print recipe" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: /edit recipe/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Print recipe" })).toBeNull();
  });
});
