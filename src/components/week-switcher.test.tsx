// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeekSwitcher } from "./week-switcher";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("WeekSwitcher", () => {
  it("does not print the open week between Previous and Next", () => {
    render(<WeekSwitcher weekStart="2026-08-31" />);
    expect(screen.getByRole("button", { name: "Previous week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next week" })).toBeTruthy();
    expect(screen.queryByText(/aug 31/i)).toBeNull();
  });
});
