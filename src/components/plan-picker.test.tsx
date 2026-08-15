// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanPicker } from "./plan-picker";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("PlanPicker", () => {
  it("links the current badge to the newest plan for that week", () => {
    render(
      <PlanPicker
        selectedId="old"
        hrefPrefix="/?plan="
        plans={[
          { id: "newest", weekStart: "2026-08-10", isCurrent: true },
          { id: "old", weekStart: "2026-08-10", isCurrent: false },
        ]}
      />,
    );

    const current = screen.getByRole("link", { name: /current/i });
    expect(current.getAttribute("href")).toBe("/?plan=newest");
    expect(
      screen.getAllByRole("button", { name: /delete plan 2026-08-10/i }),
    ).toHaveLength(2);
  });
});
