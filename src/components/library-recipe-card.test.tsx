// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal, Person } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { LibraryRecipeCard } from "./library-recipe-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: "meal-salmon",
    planId: "",
    day: "monday",
    slot: "dinner",
    title: "Lemon herb salmon",
    whyItFits: "High-protein weeknight dinner",
    cookMinutes: 12,
    method: "sheet pan",
    ingredients: [
      { name: "salmon", quantity: "1", unit: "lb", aisle: "meat" },
      { name: "lemon", quantity: "1", unit: "", aisle: "produce" },
      { name: "dill", quantity: "1", unit: "tbsp", aisle: "produce" },
    ],
    steps: ["Roast"],
    usedWebSearch: false,
    pinned: false,
    createdAt: "2026-08-10T12:00:00.000Z",
    sourceUrl: null,
    imageUrl: "https://cdn.example.com/salmon.jpg",
    extras: EMPTY_EXTRAS,
    draft: false,
    stars: 4,
    takeout: false,
    leftover: false,
    servings: 4,
    ...overrides,
  };
}

const ada: Person = {
  id: "ada",
  name: "Ada",
  age: 8,
  sex: null,
  allergies: ["shrimp"],
  avoidances: [],
};

function renderCard(
  overrides: Partial<ComponentProps<typeof LibraryRecipeCard>> = {},
) {
  const props = {
    meal: meal(),
    people: [] as Person[],
    onOpen: vi.fn(),
    onCook: vi.fn(),
    onAddToPlan: vi.fn(),
    onRate: vi.fn(),
    ...overrides,
  };
  const view = render(<LibraryRecipeCard {...props} />);
  return { ...view, ...props };
}

describe("LibraryRecipeCard", () => {
  it("renders a dinner with image, minutes, slot, ingredients, why, stars, cook, add, and delete", () => {
    const { container } = renderCard();

    expect(container.querySelector(".library-card")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example.com/salmon.jpg",
    );
    expect(screen.getByText("12 min")).toBeTruthy();
    expect(screen.getByText("Dinner")).toBeTruthy();
    expect(screen.getByText("salmon • lemon")).toBeTruthy();
    expect(screen.queryByText(/dill/i)).toBeNull();
    expect(screen.getByText("Lemon herb salmon")).toBeTruthy();
    expect(screen.getByText("High-protein weeknight dinner")).toBeTruthy();
    expect(screen.getByText("Servings: 4")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Rating" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "4 stars" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Cook" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Add to Plan" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete meal" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /favorite/i })).toBeNull();
    expect(screen.queryByText(/\d+\s*cal/i)).toBeNull();
    expect(screen.queryByText(/\d+g protein/i)).toBeNull();
  });

  it("shows an allergen flag when ingredients match a person allergy", () => {
    renderCard({
      meal: meal({
        ingredients: [
          { name: "shrimp", quantity: "1", unit: "lb", aisle: "meat" },
        ],
      }),
      people: [ada],
    });
    expect(screen.getByRole("alert").textContent).toMatch(/shrimp/i);
  });

  it("does not show an allergen flag when nothing matches", () => {
    renderCard({ people: [ada] });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("opens from photo/body and does not open when Cook or Add to Plan is clicked", () => {
    const { onOpen, onCook, onAddToPlan } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: /lemon herb salmon/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: "meal-salmon" }),
    );

    onOpen.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Cook" }));
    expect(onCook).toHaveBeenCalledTimes(1);
    expect(onCook).toHaveBeenCalledWith(
      expect.objectContaining({ id: "meal-salmon" }),
    );
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "+ Add to Plan" }));
    expect(onAddToPlan).toHaveBeenCalledTimes(1);
    expect(onAddToPlan).toHaveBeenCalledWith(
      expect.objectContaining({ id: "meal-salmon" }),
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("rates without firing onOpen", () => {
    const { onOpen, onRate } = renderCard();
    fireEvent.click(screen.getByRole("button", { name: "5 stars" }));
    expect(onRate).toHaveBeenCalledWith(5);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
