// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSlotMask } from "@/lib/slot-mask";
import { SlotPicker } from "./slot-picker";

afterEach(() => {
  cleanup();
});

describe("SlotPicker", () => {
  it("shows the table when it is not collapsible", () => {
    render(
      <SlotPicker value={defaultSlotMask()} onChange={() => undefined} />,
    );

    expect(
      screen.getByRole("checkbox", { name: "monday dinner" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /slots to fill/i }),
    ).toBeNull();
  });

  it("shows the table when collapsible and expanded", () => {
    render(
      <SlotPicker
        value={defaultSlotMask()}
        onChange={() => undefined}
        collapsible
        expanded
        onExpandedChange={() => undefined}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: /slots to fill/i })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen.getByRole("checkbox", { name: "monday dinner" }),
    ).toBeTruthy();
  });

  it("hides the table and shows a summary when collapsed", () => {
    render(
      <SlotPicker
        value={defaultSlotMask()}
        onChange={() => undefined}
        collapsible
        expanded={false}
        onExpandedChange={() => undefined}
      />,
    );

    const header = screen.getByRole("button", { name: /slots to fill/i });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(header.textContent).toMatch(/7 dinners/);
    expect(
      screen.queryByRole("checkbox", { name: "monday dinner" }),
    ).toBeNull();
  });

  it("notifies when the header is clicked", () => {
    const onExpandedChange = vi.fn();
    render(
      <SlotPicker
        value={defaultSlotMask()}
        onChange={() => undefined}
        collapsible
        expanded={false}
        onExpandedChange={onExpandedChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /slots to fill/i }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
  });
});
