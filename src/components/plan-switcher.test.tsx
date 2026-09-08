// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanSwitcher } from "./plan-switcher";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

const plans = [
  {
    id: "current",
    weekStart: "2026-08-31",
    isCurrent: true,
    name: "Thanksgiving week",
    favorited: true,
  },
  {
    id: "older",
    weekStart: "2026-08-10",
    isCurrent: false,
    name: "",
    favorited: false,
  },
];

describe("PlanSwitcher", () => {
  it("shows the custom name and date, not a chip pile", () => {
    render(<PlanSwitcher plans={plans} selectedId="current" allowDelete />);
    expect(screen.getByRole("button", { name: "Thanksgiving week" })).toBeTruthy();
    expect(screen.getByText(/aug 31–sep 6, 2026/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /aug 10–16, 2026/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Delete this week" }),
    ).toBeTruthy();
  });

  it("opens a grouped menu of saved weeks", () => {
    render(<PlanSwitcher plans={plans} selectedId="current" />);
    fireEvent.click(screen.getByRole("button", { name: "Open plan list" }));
    expect(screen.getByRole("heading", { name: "Favorites" })).toBeTruthy();
    expect(screen.getByRole("option", { name: /thanksgiving week/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /aug 10–16, 2026/i })).toBeTruthy();
  });

  it("hides delete on the shopping list", () => {
    render(
      <PlanSwitcher
        plans={plans}
        selectedId="current"
        hrefPrefix="/shopping-list?plan="
        homeHref="/shopping-list"
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete this week" })).toBeNull();
  });
});
