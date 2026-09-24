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
        imageUrl: null,
        extras: EMPTY_EXTRAS,
  draft: false,
  stars: 0,
  takeout: false,
  leftover: false,
  servings: 2,
};

describe("MealsCatalog", () => {
  it("collapses generate/import/manual by default and uses the new titles", () => {
    render(
      <MealsCatalog meals={[meal]} servings={2} currentPlanId={null} />,
    );
    expect(
      screen.getByRole("button", { name: "Generate Meals with AI" }).getAttribute(
        "aria-expanded",
      ),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Import Recipe from URL" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Manually Add a Recipe" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(screen.queryByLabelText("Recipe URL")).toBeNull();
    expect(screen.queryByText("New recipe")).toBeNull();
    expect(screen.queryByText("Add recipe")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Generate Meals with AI" }),
    );
    expect(
      screen.getByRole("button", { name: "Generate Recipes with AI" }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Import Recipe from URL" }),
    );
    expect(screen.getByLabelText("Recipe URL")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Manually Add a Recipe" }),
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.queryByText("New recipe")).toBeNull();
    expect(screen.queryByText("Add recipe")).toBeNull();
  });

  it("keeps catalog meal-type sections expanded and collapsible with a chevron control", () => {
    render(
      <MealsCatalog meals={[meal]} servings={2} currentPlanId={null} />,
    );
    const dinner = screen.getByRole("button", { name: /^dinner$/i });
    expect(dinner.getAttribute("aria-expanded")).toBe("true");
    expect(dinner.querySelector(".collapsible-chevron.is-open")).toBeTruthy();
    expect(screen.getByRole("button", { name: /lemon herb salmon/i })).toBeTruthy();
    fireEvent.click(dinner);
    expect(dinner.getAttribute("aria-expanded")).toBe("false");
    expect(dinner.querySelector(".collapsible-chevron.is-open")).toBeNull();
    expect(dinner.querySelector(".collapsible-chevron")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /lemon herb salmon/i })).toBeNull();
  });

  it("shows servings on catalog cards and opens the recipe flyout", () => {
    render(
      <MealsCatalog meals={[meal]} servings={2} currentPlanId={null} />,
    );

    expect(screen.getByText("Servings: 2")).toBeTruthy();
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

  it("shows a trash delete control on catalog cards", () => {
    render(
      <MealsCatalog meals={[meal]} servings={2} currentPlanId={null} />,
    );
    expect(screen.getByRole("button", { name: "Delete meal" })).toBeTruthy();
  });

  it("asks before deleting a catalog meal and posts only when confirmed", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.mocked(fetch);
    render(
      <MealsCatalog meals={[meal]} servings={2} currentPlanId={null} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete meal" }));
    expect(confirm).toHaveBeenCalledWith("Delete this meal from the library?");
    expect(
      fetchMock.mock.calls.some(([url]) => String(url) === "/api/delete"),
    ).toBe(false);

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete meal" }));
    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url) === "/api/delete" &&
            (init as RequestInit | undefined)?.method === "POST" &&
            String((init as RequestInit).body) ===
              JSON.stringify({ mealId: "meal-salmon" }),
        ),
      ).toBe(true);
    });
    confirm.mockRestore();
  });

  it("shows drafts below add cards and above search", () => {
    const draft: Meal = {
      ...meal,
      id: "draft-chili",
      title: "Draft chili",
      sourceUrl: null,
        imageUrl: null,
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
    const generate = screen.getByRole("button", {
      name: "Generate Meals with AI",
    });
    const draftsHeading = screen.getByText("Review before they join the library");
    const search = screen.getByLabelText("Search");
    expect(
      generate.compareDocumentPosition(draftsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      draftsHeading.compareDocumentPosition(search) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(screen.getByText("Draft chili")).toBeTruthy();
  });
});
