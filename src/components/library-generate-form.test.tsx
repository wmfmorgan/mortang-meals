// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Person } from "@/lib/types";
import { LibraryGenerateForm } from "./library-generate-form";

const startLibrary = vi.hoisted(() => vi.fn());

vi.mock("./generation-provider", () => ({
  useGeneration: () => ({
    state: { status: "idle", kind: "library" },
    startLibrary,
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  startLibrary.mockReset();
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ prefs: null }),
    }),
  );
});

const alex: Person = {
  id: "p1",
  name: "Alex",
  age: 40,
  sex: "male",
  allergies: [],
  avoidances: [],
};

describe("LibraryGenerateForm", () => {
  it("sends a dinner batch with diet and people", async () => {
    render(<LibraryGenerateForm people={[alex]} />);
    fireEvent.change(screen.getByPlaceholderText("or type your own"), {
      target: { value: "italian" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Generate drafts" }).closest("form")!);
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      dinner: { count: 4, diet: "italian", avoidances: "" },
    });
  });

  it("fills diet from a preset choice", async () => {
    render(<LibraryGenerateForm people={[alex]} />);
    fireEvent.click(screen.getByRole("button", { name: "keto" }));
    fireEvent.submit(screen.getByRole("button", { name: "Generate drafts" }).closest("form")!);
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      dinner: { count: 4, diet: "keto", avoidances: "" },
    });
  });

  it("sends a one-recipe request", async () => {
    render(<LibraryGenerateForm people={[alex]} />);
    fireEvent.click(screen.getByRole("button", { name: "One recipe" }));
    fireEvent.change(screen.getByPlaceholderText("spaghetti sauce"), {
      target: { value: "spaghetti sauce" },
    });
    fireEvent.change(screen.getByPlaceholderText("or type your own"), {
      target: { value: "italian" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Generate drafts" }).closest("form")!);
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      request: {
        slot: "dinner",
        text: "spaghetti sauce",
        diet: "italian",
        avoidances: "",
      },
    });
  });
});
