// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationStatus } from "./generation-status";

const generation = vi.hoisted(() => ({
  state: {
    status: "idle" as "idle" | "running" | "success" | "error",
    kind: "library" as "generate" | "import" | "library",
    phase: "calling" as string | null,
    message: "Calling grok-4.6",
    attempt: 1 as number | null,
    model: "grok-4.6" as string | null,
    startedAt: Date.now() as number | null,
    error: null as string | null,
  },
  cancel: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("./generation-provider", () => ({
  useGeneration: () => generation,
}));

afterEach(() => {
  cleanup();
  generation.cancel.mockReset();
  generation.dismiss.mockReset();
  generation.state = {
    status: "idle",
    kind: "library",
    phase: "calling",
    message: "Calling grok-4.6",
    attempt: 1,
    model: "grok-4.6",
    startedAt: Date.now(),
    error: null,
  };
});

describe("GenerationStatus", () => {
  it("renders nothing when idle", () => {
    render(<GenerationStatus />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a nav chip while library generate is running", () => {
    generation.state.status = "running";
    render(<GenerationStatus />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText(/Generating library/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("shows progress details on hover while running", () => {
    generation.state.status = "running";
    render(<GenerationStatus />);
    expect(screen.queryByText("Calling the model")).toBeNull();
    fireEvent.mouseEnter(screen.getByRole("status").parentElement!);
    expect(screen.getByText("Calling the model")).toBeTruthy();
    expect(screen.getByText("Calling grok-4.6")).toBeTruthy();
  });

  it("expands steps and cancels from the panel", () => {
    generation.state.status = "running";
    render(<GenerationStatus />);
    fireEvent.click(screen.getByRole("button", { name: /Generating library/ }));
    expect(screen.getByText("Calling the model")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(generation.cancel).toHaveBeenCalled();
  });

  it("shows drafts-ready until dismissed", () => {
    generation.state = {
      ...generation.state,
      status: "success",
      phase: "done",
      message: "Drafts are ready",
    };
    render(<GenerationStatus />);
    expect(screen.getAllByText("Drafts are ready").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Ok" }));
    expect(generation.dismiss).toHaveBeenCalled();
  });

  it("shows the failure reason after clicking the chip", () => {
    generation.state = {
      ...generation.state,
      status: "error",
      message: "Couldn’t get usable recipes, try again.",
      error: "Couldn’t get usable recipes, try again.",
    };
    render(<GenerationStatus />);
    expect(
      screen.queryByText("Couldn’t get usable recipes, try again."),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Generate failed/ }));
    expect(
      screen.getByText("Couldn’t get usable recipes, try again."),
    ).toBeTruthy();
  });
});
