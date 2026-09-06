// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { DraftQueue } from "./draft-queue";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
});

const draft: Meal = {
  id: "draft-1",
  planId: "",
  day: "monday",
  slot: "dinner",
  title: "Draft chili",
  whyItFits: "Hearty",
  cookMinutes: 40,
  method: "stovetop",
  ingredients: [{ name: "beef", quantity: "1", unit: "lb", aisle: "meat" }],
  steps: ["Simmer"],
  usedWebSearch: false,
  pinned: false,
  createdAt: "2026-09-01T12:00:00.000Z",
  sourceUrl: null,
  extras: EMPTY_EXTRAS,
  draft: true,
  stars: 0,
  takeout: false,
  leftover: false,
};

describe("DraftQueue", () => {
  it("approves a draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftQueue drafts={[draft]} servings={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/library/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ mealId: "draft-1" }),
        }),
      );
    });
  });

  it("rejects a draft", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<DraftQueue drafts={[draft]} servings={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/library/reject",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ mealId: "draft-1" }),
        }),
      );
    });
  });
});
