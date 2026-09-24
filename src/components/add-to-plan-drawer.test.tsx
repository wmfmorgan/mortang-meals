// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { AddToPlanDrawer } from "./add-to-plan-drawer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    ingredients: [{ name: "salmon", quantity: "1", unit: "lb", aisle: "meat" }],
    steps: ["Roast"],
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
    servings: 4,
    ...overrides,
  };
}

function renderDrawer(
  overrides: Partial<ComponentProps<typeof AddToPlanDrawer>> = {},
) {
  const props = {
    meal: meal(),
    weekStart: "2026-08-10",
    onPlaced: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const view = render(<AddToPlanDrawer {...props} />);
  return { ...view, ...props };
}

function radio(name: string): HTMLInputElement {
  return screen.getByRole("radio", { name }) as HTMLInputElement;
}

describe("AddToPlanDrawer", () => {
  it("defaults slot from the meal when it is breakfast, lunch, or dinner", () => {
    const { rerender, weekStart, onPlaced, onClose } = renderDrawer({
      meal: meal({ slot: "breakfast" }),
    });
    expect(radio("Breakfast").checked).toBe(true);
    expect(screen.getByRole("button", { name: "Monday" }).getAttribute("aria-pressed")).toBe(
      "true",
    );

    rerender(
      <AddToPlanDrawer
        meal={meal({ slot: "lunch" })}
        weekStart={weekStart}
        onPlaced={onPlaced}
        onClose={onClose}
      />,
    );
    expect(radio("Lunch").checked).toBe(true);

    rerender(
      <AddToPlanDrawer
        meal={meal({ slot: "dinner" })}
        weekStart={weekStart}
        onPlaced={onPlaced}
        onClose={onClose}
      />,
    );
    expect(radio("Dinner").checked).toBe(true);
  });

  it("defaults a dessert to dinner", () => {
    renderDrawer({ meal: meal({ slot: "dessert" }) });
    expect(radio("Dinner").checked).toBe(true);
    expect(radio("Breakfast").checked).toBe(false);
    expect(radio("Lunch").checked).toBe(false);
  });

  it("posts Thursday lunch to the current week and calls onPlaced", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { onPlaced, onClose } = renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: "Thursday" }));
    fireEvent.click(radio("Lunch"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/place");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      sourceMealId: "meal-salmon",
      day: "thursday",
      slot: "lunch",
      weekStart: "2026-08-10",
    });
    expect(onPlaced).toHaveBeenCalledTimes(1);
    expect(onPlaced).toHaveBeenCalledWith("thursday", "lunch");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape, Dismiss, and backdrop without posting", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { onClose, rerender, weekStart, onPlaced, meal: drawn } = renderDrawer();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    onClose.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    onClose.mockClear();
    rerender(
      <AddToPlanDrawer
        meal={drawn}
        weekStart={weekStart}
        onPlaced={onPlaced}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("has Stitch chrome without portions, grocery copy, or clock times", () => {
    renderDrawer();
    expect(screen.getByText("Add to Meal Plan")).toBeTruthy();
    expect(screen.getByText("Lemon herb salmon")).toBeTruthy();
    expect(
      screen.getAllByRole("button", {
        name: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/,
      }),
    ).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Monday" }).textContent).toBe("M");
    expect(screen.getByRole("button", { name: "Tuesday" }).textContent).toBe("T");
    expect(screen.getByRole("button", { name: "Wednesday" }).textContent).toBe("W");
    expect(screen.getByRole("button", { name: "Thursday" }).textContent).toBe("T");
    expect(screen.getByRole("button", { name: "Friday" }).textContent).toBe("F");
    expect(screen.getByRole("button", { name: "Saturday" }).textContent).toBe("S");
    expect(screen.getByRole("button", { name: "Sunday" }).textContent).toBe("S");
    expect(screen.getByRole("radio", { name: "Breakfast" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Lunch" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Dinner" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
    expect(screen.queryByText(/portions/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "+" })).toBeNull();
    expect(screen.queryByRole("button", { name: "-" })).toBeNull();
    expect(screen.queryByText(/grocery/i)).toBeNull();
    expect(screen.queryByText("07:00")).toBeNull();
    expect(screen.queryByText("12:30")).toBeNull();
    expect(screen.queryByText("19:00")).toBeNull();
    expect(screen.queryByText(/week 42/i)).toBeNull();
  });
});
