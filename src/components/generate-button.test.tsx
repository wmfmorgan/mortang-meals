// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { defaultSlotMask, emptySlotMask } from "@/lib/slot-mask";
import { GenerateButton } from "./generate-button";

vi.mock("./generation-provider", () => ({
  useGeneration: () => ({
    state: { status: "idle" },
    startGenerate: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
});

describe("GenerateButton", () => {
  it("is enabled when a slot is checked", () => {
    render(
      <GenerateButton disabledReason={null} slotMask={defaultSlotMask()} />,
    );
    expect(
      (screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("is disabled when no slots are checked", () => {
    render(<GenerateButton disabledReason={null} slotMask={emptySlotMask()} />);
    expect(
      (screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("is disabled when the only checked slots are pinned", () => {
    const mask = emptySlotMask();
    mask.monday.dinner = true;
    const pinned = {
      day: "monday",
      slot: "dinner",
      pinned: true,
    } as Meal;
    render(
      <GenerateButton
        disabledReason={null}
        slotMask={mask}
        pinnedMeals={[pinned]}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Generate" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
