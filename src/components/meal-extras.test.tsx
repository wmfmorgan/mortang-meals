// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  router.push.mockReset();
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
        imageUrl: null,
        extras: EMPTY_EXTRAS,
    draft: false,
    stars: 0,
    takeout: false,
    leftover: false,
  servings: 2,
    ...overrides,
  };
}

describe("MealCard extras", () => {
  it("uses bottom icons to choose a side or dessert", () => {
    const onChooseExtra = vi.fn();
    render(
      <MealCard
        meal={meal({ slot: "lunch" })}
        editable
        onChooseExtra={onChooseExtra}
      />,
    );
    const side = screen.getByRole("button", { name: "Choose a side" });
    expect(side.getAttribute("title")).toBe("Choose a side");
    fireEvent.click(side);
    expect(onChooseExtra).toHaveBeenCalledWith("side");

    const dessert = screen.getByRole("button", { name: "Choose a dessert" });
    expect(dessert.getAttribute("title")).toBe("Choose a dessert");
    fireEvent.click(dessert);
    expect(onChooseExtra).toHaveBeenCalledWith("dessert");

    expect(screen.queryByRole("button", { name: "Add side" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add dessert" })).toBeNull();
  });

  it("keeps side/dessert icons when filled so they can replace", () => {
    const onChooseExtra = vi.fn();
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
        onChooseExtra={onChooseExtra}
      />,
    );
    expect(screen.getByText("Side · Baked potato")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replace side" }));
    expect(onChooseExtra).toHaveBeenCalledWith("side");
    expect(
      screen.getByRole("button", { name: "Choose a dessert" }),
    ).toBeTruthy();
  });

  it("does not show extras on breakfast", () => {
    render(
      <MealCard
        meal={meal({ slot: "breakfast" })}
        editable
        onChooseExtra={vi.fn()}
        onLeftover={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /side/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /dessert/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Place leftovers on another meal" }),
    ).toBeTruthy();
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
        onChooseExtra={vi.fn()}
      />,
    );
    expect(screen.getByText("Side · Baked potato")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /baked potato/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Get recipe" })).toBeNull();
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
      imageUrl: null,
    };
    render(
      <MealCard
        meal={meal({ extras: { side: extra, dessert: null } })}
        onOpen={onOpen}
        onOpenExtra={onOpenExtra}
        editable
        onChooseExtra={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Side · Garlic green beans" }));
    expect(onOpenExtra).toHaveBeenCalledWith(extra);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("puts leftovers on an icon with a tooltip", () => {
    const onLeftover = vi.fn();
    render(
      <MealCard
        meal={meal()}
        editable
        compact
        onChooseExtra={vi.fn()}
        onLeftover={onLeftover}
      />,
    );
    const btn = screen.getByRole("button", {
      name: "Place leftovers on another meal",
    });
    expect(btn.getAttribute("title")).toBe("Place leftovers on another meal");
    fireEvent.click(btn);
    expect(onLeftover).toHaveBeenCalled();
  });

  it("puts compact actions in an even bottom row with trash delete", () => {
    render(
      <MealCard
        meal={meal({
          title:
            "Sheet-pan miso-glazed salmon with roasted broccoli and sesame",
        })}
        editable
        compact
        onChooseExtra={vi.fn()}
        onLeftover={vi.fn()}
      />,
    );

    const actions = document.querySelector(
      ".meal-card-compact .meal-card-action-icons",
    );
    expect(actions).toBeTruthy();
    expect(document.querySelector(".meal-card-tools")).toBeNull();

    const labels = [...actions!.querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(labels).toEqual([
      "Choose a side",
      "Choose a dessert",
      "Place leftovers on another meal",
      "Delete meal",
    ]);
    expect(
      screen.getByText(
        "Sheet-pan miso-glazed salmon with roasted broccoli and sesame",
      ),
    ).toBeTruthy();
  });

  it("puts a centered Cook control above compact action icons", () => {
    const onOpen = vi.fn();
    render(
      <MealCard
        meal={meal()}
        editable
        compact
        onOpen={onOpen}
        onChooseExtra={vi.fn()}
        onLeftover={vi.fn()}
      />,
    );
    const cook = screen.getByRole("button", { name: "Cook" });
    const cookRow = document.querySelector(".meal-card-cook-row");
    const actions = document.querySelector(
      ".meal-card-compact .meal-card-action-icons",
    );
    expect(cookRow).toBeTruthy();
    expect(cookRow!.contains(cook)).toBe(true);
    expect(
      cookRow!.compareDocumentPosition(actions!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(cook);
    expect(router.push).toHaveBeenCalledWith("/meals/meal-salmon");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("hides Cook on takeout compact cards", () => {
    render(<MealCard meal={meal({ takeout: true })} editable compact />);
    expect(screen.queryByRole("button", { name: "Cook" })).toBeNull();
  });

  it("shows Cook on leftover compact cards", () => {
    render(<MealCard meal={meal({ leftover: true })} editable compact />);
    expect(screen.getByRole("button", { name: "Cook" })).toBeTruthy();
  });
});
