// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Meal, Person } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { MealsCatalog } from "./meals-catalog";

const refresh = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
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
  refresh.mockReset();
  push.mockReset();
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

function meal(overrides: Partial<Meal> = {}): Meal {
  return {
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
    ...overrides,
  };
}

const yogurt: Meal = meal({
  id: "meal-yogurt",
  slot: "breakfast",
  title: "Yogurt bowl",
  whyItFits: "Quick morning",
  cookMinutes: 10,
  method: "stovetop",
  ingredients: [{ name: "yogurt", quantity: "1", unit: "cup", aisle: "dairy" }],
  sourceUrl: null,
});

const soup: Meal = meal({
  id: "meal-soup",
  slot: "lunch",
  title: "Tomato soup",
  whyItFits: "Cozy",
  cookMinutes: 25,
  method: "stovetop",
  ingredients: [{ name: "tomato", quantity: "2", unit: "cup", aisle: "produce" }],
  sourceUrl: null,
});

const alex: Person = {
  id: "p1",
  name: "Alex",
  age: 40,
  sex: "male",
  allergies: ["shrimp"],
  avoidances: [],
};

function renderCatalog(
  overrides: Partial<Parameters<typeof MealsCatalog>[0]> = {},
) {
  return render(
    <MealsCatalog
      meals={[meal()]}
      drafts={[]}
      people={[]}
      householdName="Mortang"
      servings={2}
      currentPlanId={null}
      weekStart="2026-08-10"
      {...overrides}
    />,
  );
}

describe("MealsCatalog", () => {
  it("opens the New Recipe chooser and drops collapsible generate/import/manual cards", () => {
    renderCatalog();

    expect(screen.getByRole("heading", { name: "Recipe Library" })).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Generate Meals with AI" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Import Recipe from URL" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Manually Add a Recipe" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "New Recipe" }));
    expect(screen.getByRole("heading", { name: "Add New Recipe" })).toBeTruthy();
    expect(screen.getByText("Import from URL")).toBeTruthy();
    expect(screen.getByText("Create with AI Chef")).toBeTruthy();
    expect(screen.getByText("Manual Recipe Entry")).toBeTruthy();
  });

  it("filters the catalog by search", () => {
    renderCatalog({ meals: [meal(), yogurt] });
    expect(screen.getByText("Lemon herb salmon")).toBeTruthy();
    expect(screen.getByText("Yogurt bowl")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "yogurt" },
    });
    expect(screen.queryByText("Lemon herb salmon")).toBeNull();
    expect(screen.getByText("Yogurt bowl")).toBeTruthy();
  });

  it("groups Meal Type with expanded Breakfast/Lunch/Dinner headings", () => {
    renderCatalog({ meals: [meal(), yogurt, soup] });

    fireEvent.click(screen.getByRole("button", { name: "Meal Type" }));
    const breakfast = screen.getByRole("button", { name: /^breakfast$/i });
    const lunch = screen.getByRole("button", { name: /^lunch$/i });
    const dinner = screen.getByRole("button", { name: /^dinner$/i });
    expect(breakfast.getAttribute("aria-expanded")).toBe("true");
    expect(lunch.getAttribute("aria-expanded")).toBe("true");
    expect(dinner.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Lemon herb salmon")).toBeTruthy();
    expect(screen.getByText("Yogurt bowl")).toBeTruthy();
    expect(screen.getByText("Tomato soup")).toBeTruthy();
  });

  it("hides a 30-minute meal when the Under 20m chip is pressed", () => {
    renderCatalog({ meals: [meal(), yogurt] });
    expect(screen.getByText("Lemon herb salmon")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Under 20m" }));
    expect(screen.queryByText("Lemon herb salmon")).toBeNull();
    expect(screen.getByText("Yogurt bowl")).toBeTruthy();
  });

  it("sends Cook to the recipe page", () => {
    renderCatalog();
    const cookLink = screen.queryByRole("link", { name: "Cook" });
    if (cookLink) {
      expect(cookLink.getAttribute("href")).toBe("/meals/meal-salmon");
      return;
    }
    fireEvent.click(screen.getByRole("button", { name: "Cook" }));
    expect(push).toHaveBeenCalledWith("/meals/meal-salmon");
  });

  it("opens Add to Plan, toasts on place, and closes the drawer", async () => {
    renderCatalog();
    fireEvent.click(screen.getByRole("button", { name: "+ Add to Plan" }));
    const drawer = screen.getByRole("dialog", { name: "Add to Meal Plan" });
    expect(drawer).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Thursday" }));
    fireEvent.click(within(drawer).getByRole("radio", { name: "Lunch" }));
    fireEvent.click(within(drawer).getByRole("button", { name: "Confirm" }));

    await vi.waitFor(() => {
      expect(screen.getByRole("status").textContent).toMatch(
        /Added to Thursday lunch/i,
      );
    });
    expect(screen.queryByRole("dialog", { name: "Add to Meal Plan" })).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it("asks before deleting a catalog meal and posts only when confirmed", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = vi.mocked(fetch);
    renderCatalog();

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

  it("opens the recipe flyout from the card title/photo", () => {
    renderCatalog();
    fireEvent.click(screen.getByRole("button", { name: /lemon herb salmon/i }));
    expect(screen.getByRole("dialog", { name: /lemon herb salmon/i })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /open full recipe/i }).getAttribute("href"),
    ).toBe("/meals/meal-salmon");
  });

  it("renders drafts when they are passed", () => {
    const draft: Meal = meal({
      id: "draft-chili",
      title: "Draft chili",
      sourceUrl: null,
      draft: true,
    });
    renderCatalog({
      meals: [meal()],
      drafts: [draft],
      people: [alex],
    });
    expect(screen.getByText("Review before they join the library")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reject" })).toBeTruthy();
    expect(screen.getByText("Draft chili")).toBeTruthy();
  });
});
