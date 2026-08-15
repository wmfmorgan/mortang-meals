// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SlotMask, WeekPlan } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { WeekGrid } from "./week-grid";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

function emptyMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      Object.fromEntries(SLOTS.map((slot) => [slot, false])),
    ]),
  ) as SlotMask;
}

function mondayDinnerPlan(): WeekPlan {
  const slotMask = emptyMask();
  slotMask.monday.dinner = true;
  return {
    id: "plan-1",
    weekStart: "2026-01-05",
    isCurrent: true,
    slotMask,
    meals: [
      {
        id: "meal-salmon",
        planId: "plan-1",
        day: "monday",
        slot: "dinner",
        title: "Lemon herb salmon",
        whyItFits: "High-protein Mediterranean",
        cookMinutes: 35,
        method: "sheet pan",
        ingredients: [
          { name: "salmon", quantity: "1", unit: "lb", aisle: "meat" },
        ],
        steps: ["Roast"],
        usedWebSearch: false,
        pinned: false,
        createdAt: "2026-08-10T12:00:00.000Z",
        sourceUrl: null,
      },
    ],
  };
}

describe("WeekGrid", () => {
  it("renders 21 cells with a filled monday dinner and an empty tuesday dinner", () => {
    render(<WeekGrid plan={mondayDinnerPlan()} />);

    expect(screen.getAllByRole("gridcell")).toHaveLength(21);
    expect(screen.getByText("Lemon herb salmon")).toBeTruthy();

    const emptyTuesdayDinner = screen.getByRole("gridcell", {
      name: /empty tuesday dinner/i,
    });
    expect(emptyTuesdayDinner.textContent).not.toMatch(/lemon herb salmon/i);
  });

  it("lets an empty cell add a past meal when editable", () => {
    const onAdd = vi.fn();
    render(<WeekGrid plan={mondayDinnerPlan()} onAdd={onAdd} editable />);
    fireEvent.click(screen.getByRole("button", { name: /add monday lunch/i }));
    expect(onAdd).toHaveBeenCalledWith("monday", "lunch");
  });

  it("shows a web-search star on meals generated with search", () => {
    const plan = mondayDinnerPlan();
    plan.meals[0] = { ...plan.meals[0]!, usedWebSearch: true };
    render(<WeekGrid plan={plan} />);
    expect(screen.getByText("Found with web search")).toBeTruthy();
  });

  it("shows an import icon when the meal has a source URL", () => {
    const plan = mondayDinnerPlan();
    plan.meals[0] = { ...plan.meals[0]!, sourceUrl: "https://example.com/salmon" };
    render(<WeekGrid plan={plan} />);
    expect(screen.getByText("Imported from a URL")).toBeTruthy();
  });

  it("opens a filled card through onSelectMeal", () => {
    const onSelectMeal = vi.fn();
    render(<WeekGrid plan={mondayDinnerPlan()} onSelectMeal={onSelectMeal} />);

    fireEvent.click(screen.getByRole("button", { name: /lemon herb salmon/i }));
    expect(onSelectMeal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "meal-salmon" }),
    );
  });
});
