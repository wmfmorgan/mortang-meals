// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal, Person } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { CookMode } from "./cook-mode";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
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
  steps: ["Preheat the oven to 425", "Roast until the flesh flakes"],
  usedWebSearch: false,
  pinned: false,
  createdAt: "2026-08-10T12:00:00.000Z",
  sourceUrl: null,
  imageUrl: null,
  extras: EMPTY_EXTRAS,
  draft: false,
  stars: 4,
  takeout: false,
  leftover: false,
  servings: 2,
};

const ada: Person = {
  id: "ada",
  name: "Ada",
  age: 8,
  sex: null,
  allergies: [],
  avoidances: [],
};

function renderCook(overrides: Partial<ComponentProps<typeof CookMode>> = {}) {
  return render(
    <CookMode
      meal={meal}
      people={[]}
      canSwap={false}
      actions={<button type="button">Edit</button>}
      {...overrides}
    />,
  );
}

describe("CookMode", () => {
  it("renders the title and Mise en Place", () => {
    renderCook();
    expect(
      screen.getByRole("heading", { name: /lemon herb salmon/i }),
    ).toBeTruthy();
    expect(screen.getByText("Mise en Place")).toBeTruthy();
  });

  it("counts checked ingredients as Ready", () => {
    renderCook();
    expect(screen.getByText("0 of 1 Ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("1 of 1 Ready")).toBeTruthy();
  });

  it("shows the first step and advances with Next", () => {
    renderCook();
    expect(screen.getByText("Preheat the oven to 425")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "1. Preheat the oven to 425" })
        .getAttribute("aria-current"),
    ).toBe("step");

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Roast until the flesh flakes")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "2. Roast until the flesh flakes" })
        .getAttribute("aria-current"),
    ).toBe("step");
    expect(
      screen
        .getByRole("button", { name: "1. Preheat the oven to 425" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("disables Prev on the first step and Next on the last", () => {
    renderCook();
    expect(
      (screen.getByRole("button", { name: /previous/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /next/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(
      (screen.getByRole("button", { name: /previous|step 1/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: /next/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("uses a MealImage placeholder when imageUrl is null", () => {
    const { container } = renderCook();
    expect(container.querySelector(".cook-stage-image .meal-image")).toBeTruthy();
    expect(
      container.querySelector(".cook-stage-image .meal-image-placeholder"),
    ).toBeTruthy();
  });

  it("shows whyItFits in a Counter Pro-Tip region", () => {
    renderCook();
    const tip = screen.getByRole("region", { name: "Counter Pro-Tip" });
    expect(tip.textContent).toContain("Counter Pro-Tip");
    expect(tip.textContent).toContain("High-protein Mediterranean");
  });

  it("renders the actions slot", () => {
    renderCook();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("writes checked ingredients to sessionStorage", () => {
    renderCook();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(sessionStorage.getItem("mortang.cookChecks.meal-salmon")).toBe(
      JSON.stringify([0]),
    );
  });

  it("restores checks and the active step from sessionStorage", async () => {
    sessionStorage.setItem("mortang.cookChecks.meal-salmon", JSON.stringify([0]));
    sessionStorage.setItem("mortang.cookStep.meal-salmon", JSON.stringify(1));
    renderCook();
    await vi.waitFor(() => {
      expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
        true,
      );
      expect(screen.getByText("1 of 1 Ready")).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "2. Roast until the flesh flakes" })
          .getAttribute("aria-current"),
      ).toBe("step");
    });
  });

  it("clamps an invalid stored step index to 0", async () => {
    sessionStorage.setItem("mortang.cookStep.meal-salmon", JSON.stringify(99));
    renderCook();
    await vi.waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "1. Preheat the oven to 425" })
          .getAttribute("aria-current"),
      ).toBe("step");
    });
    expect(screen.getByText("Preheat the oven to 425")).toBeTruthy();
  });

  it("shows empty-steps copy and no Next", () => {
    renderCook({ meal: { ...meal, steps: [] } });
    expect(screen.getByText("No method steps yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
  });

  it("hides stars on drafts", () => {
    renderCook({ meal: { ...meal, draft: true } });
    expect(screen.queryByRole("button", { name: "4 stars" })).toBeNull();
  });

  it("scales ingredient quantities with the servings stepper", () => {
    renderCook();
    expect(screen.getByText("1 lb salmon")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Increase servings" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase servings" }));
    expect(screen.getByText("2 lb salmon")).toBeTruthy();
  });

  it("shows the allergen ribbon from household people", () => {
    renderCook({ people: [ada] });
    expect(screen.getByText("Allergen safe for Ada.")).toBeTruthy();
  });
});
