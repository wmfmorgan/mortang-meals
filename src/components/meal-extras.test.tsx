// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { EMPTY_EXTRAS, suggestionExtra } from "@/meals/extras";
import { MealCard } from "./meal-card";

const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
  router.refresh.mockReset();
});

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
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
    draft: false,
    stars: 0,
    takeout: false,
    leftover: false,
    ...overrides,
  };
}

describe("MealCard extras", () => {
  it("lets an editable lunch add a side or dessert", () => {
    render(
      <MealCard
        meal={meal({ slot: "lunch" })}
        editable
        onChooseExtra={() => {}}
      />,
    );
    const side = screen.getByRole("group", { name: "Add a side" });
    expect(within(side).getByRole("button", { name: "Add side" })).toBeTruthy();
    expect(within(side).getByRole("button", { name: "Suggestion" })).toBeTruthy();
    expect(within(side).getByRole("button", { name: "Recipe" })).toBeTruthy();
    expect(
      within(side).getByRole("button", { name: "Choose a past side" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add dessert" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Choose a past dessert" }),
    ).toBeTruthy();
  });

  it("does not show extras on breakfast", () => {
    render(<MealCard meal={meal({ slot: "breakfast" })} editable />);
    expect(screen.queryByRole("button", { name: "Add side" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add dessert" })).toBeNull();
  });

  it("shows a suggestion as text, not a flyout button", () => {
    render(
      <MealCard
        meal={meal({
          extras: {
            side: suggestionExtra({
              id: "side-1",
              kind: "side",
              title: "Baked potato",
            }),
            dessert: null,
          },
        })}
        editable
      />,
    );
    expect(screen.getByText("Side · Baked potato")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /baked potato/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Get recipe" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^remove$/i })).toBeNull();
    const clear = screen.getByRole("button", { name: "Remove side" });
    expect(clear.textContent).toBe("×");
  });

  it("opens a recipe extra without opening the parent meal", () => {
    const onOpen = vi.fn();
    const onOpenExtra = vi.fn();
    const extra = {
      id: "side-2",
      kind: "side" as const,
      mode: "recipe" as const,
      title: "Garlic green beans",
      whyItFits: "Fresh",
      cookMinutes: 12,
      method: "skillet",
      ingredients: [
        { name: "green beans", quantity: "1", unit: "lb", aisle: "produce" as const },
      ],
      steps: ["Saute"],
      usedWebSearch: false,
      sourceUrl: null,
    };
    render(
      <MealCard
        meal={meal({ extras: { side: extra, dessert: null } })}
        onOpen={onOpen}
        onOpenExtra={onOpenExtra}
        editable
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Side · Garlic green beans" }));
    expect(onOpenExtra).toHaveBeenCalledWith(extra);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
