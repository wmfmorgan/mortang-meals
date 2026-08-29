// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { SwapButton } from "./meal-card";

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
  vi.unstubAllGlobals();
});

const meal: Meal = {
  id: "meal-salmon",
  planId: "plan-1",
  day: "monday",
  slot: "dinner",
  title: "Lemon herb salmon",
  whyItFits: "High-protein Mediterranean",
  cookMinutes: 35,
  method: "sheet pan",
  ingredients: [{ name: "salmon", quantity: "1", unit: "lb", aisle: "meat" }],
  steps: ["Roast"],
  usedWebSearch: false,
  pinned: false,
  createdAt: "2026-08-10T12:00:00.000Z",
  sourceUrl: null,
  extras: EMPTY_EXTRAS,
};

describe("SwapButton", () => {
  it("does not post until the popover is confirmed", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<SwapButton meal={meal} />);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate meal" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/made on the grill/i)).toBeTruthy();
  });

  it("posts a typed prompt when confirmed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meal }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SwapButton meal={meal} />);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate meal" }));
    fireEvent.change(screen.getByPlaceholderText(/made on the grill/i), {
      target: { value: "hamburger based" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      prompt?: string;
    };
    expect(body.prompt).toBe("hamburger based");
  });

  it("omits prompt when confirmed empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meal }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SwapButton meal={meal} />);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate meal" }));
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      prompt?: string;
    };
    expect(body.prompt).toBeUndefined();
  });
});
