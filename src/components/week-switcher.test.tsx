// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mondayOf, shiftMonday } from "@/lib/week";
import { WeekSwitcher } from "./week-switcher";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("WeekSwitcher", () => {
  it("offers Previous, Current week, and Next without printing the open range", () => {
    render(<WeekSwitcher weekStart="2026-08-31" />);
    expect(screen.getByRole("button", { name: "Previous week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Current week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next week" })).toBeTruthy();
    expect(screen.queryByText(/aug 31/i)).toBeNull();
  });

  it("disables Current week when already viewing this calendar week", () => {
    render(<WeekSwitcher weekStart={mondayOf(new Date())} />);
    expect(
      (screen.getByRole("button", { name: "Current week" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("enables Current week when viewing another week", () => {
    render(
      <WeekSwitcher weekStart={shiftMonday(mondayOf(new Date()), -2)} />,
    );
    expect(
      (screen.getByRole("button", { name: "Current week" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
