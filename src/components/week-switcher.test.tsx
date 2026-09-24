// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mondayOf, shiftMonday } from "@/lib/week";
import { WeekSwitcher } from "./week-switcher";

const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
  router.refresh.mockReset();
  router.push.mockReset();
  vi.unstubAllGlobals();
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

  it("opens Previous week on that plan URL so / does not snap back to this calendar week", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          plan: { id: "plan-prev", weekStart: "2026-08-24" },
        }),
      })),
    );
    render(<WeekSwitcher weekStart="2026-08-31" />);
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/?plan=plan-prev");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/plans/open",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ weekStart: "2026-08-24" }),
      }),
    );
  });

  it("opens Next week on that plan URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          plan: { id: "plan-next", weekStart: "2026-09-07" },
        }),
      })),
    );
    render(<WeekSwitcher weekStart="2026-08-31" />);
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/?plan=plan-next");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/plans/open",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ weekStart: "2026-09-07" }),
      }),
    );
  });
});
