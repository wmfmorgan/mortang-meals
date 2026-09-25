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
    fireEvent.submit(screen.getByRole("button", { name: "Generate Recipes with AI" }).closest("form")!);
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      servings: 1,
      dinner: { count: 4, diet: "italian", avoidances: "" },
    });
  });

  it("fills diet from a preset choice", async () => {
    render(<LibraryGenerateForm people={[alex]} />);
    fireEvent.click(screen.getByRole("button", { name: "keto" }));
    fireEvent.submit(screen.getByRole("button", { name: "Generate Recipes with AI" }).closest("form")!);
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      servings: 1,
      dinner: { count: 4, diet: "keto", avoidances: "" },
    });
  });

  it("can batch sides and desserts with dessert criteria", async () => {
    render(<LibraryGenerateForm people={[alex]} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "dinner" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "side" }));
    fireEvent.click(screen.getByRole("button", { name: "keto" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "dessert" }));
    fireEvent.submit(screen.getByRole("button", { name: "Generate Recipes with AI" }).closest("form")!);
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      servings: 1,
      side: { count: 4, diet: "keto", avoidances: "" },
      dessert: {
        count: 4,
        diet: "low-sugar, gluten-free, dairy-free",
        avoidances: "",
      },
    });
    expect(
      screen.getByRole("button", { name: "low-sugar" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "nut-free" }).getAttribute("aria-pressed"),
    ).toBe("false");
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
    fireEvent.submit(screen.getByRole("button", { name: "Generate Recipes with AI" }).closest("form")!);
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      servings: 1,
      request: {
        slot: "dinner",
        text: "spaghetti sauce",
        diet: "italian",
        avoidances: "",
      },
    });
  });

  it("lets you override servings next to people", async () => {
    render(<LibraryGenerateForm people={[alex]} />);
    fireEvent.change(screen.getByLabelText("Servings Override"), {
      target: { value: "4" },
    });
    fireEvent.change(screen.getByPlaceholderText("or type your own"), {
      target: { value: "italian" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Generate Recipes with AI" }).closest("form")!,
    );
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      servings: 4,
      dinner: { count: 4, diet: "italian", avoidances: "" },
    });
  });

  it("calls onStarted after startLibrary is invoked", async () => {
    const onStarted = vi.fn();
    render(<LibraryGenerateForm people={[alex]} onStarted={onStarted} />);
    fireEvent.click(screen.getByRole("button", { name: "keto" }));
    fireEvent.submit(
      screen.getByRole("button", { name: "Generate Recipes with AI" }).closest("form")!,
    );
    expect(startLibrary).toHaveBeenCalled();
    expect(onStarted).toHaveBeenCalledTimes(1);
  });

  it("does not show Quick, High protein, or Kid-approved preference chips", () => {
    render(<LibraryGenerateForm people={[alex]} />);
    expect(screen.queryByRole("button", { name: "Quick < 20m" })).toBeNull();
    expect(screen.queryByRole("button", { name: "High protein" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Kid-approved" })).toBeNull();
  });

  it("defaults servings to selected people and follows the selection", () => {
    const sam: Person = {
      id: "p2",
      name: "Sam",
      age: 8,
      sex: "male",
      allergies: [],
      avoidances: [],
    };
    render(<LibraryGenerateForm people={[alex, sam]} />);
    const servings = () =>
      screen.getByLabelText("Servings Override") as HTMLInputElement;
    expect(servings().value).toBe("2");
    fireEvent.click(screen.getByRole("checkbox", { name: /sam/i }));
    expect(servings().value).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(servings().value).toBe("2");
  });

  it("clears a diet chip on a second click and generates without a diet", () => {
    render(<LibraryGenerateForm people={[alex]} />);
    fireEvent.click(screen.getByRole("button", { name: "keto" }));
    expect(
      screen.getByRole("button", { name: "keto" }).getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "keto" }));
    expect(
      screen.getByRole("button", { name: "keto" }).getAttribute("aria-pressed"),
    ).toBe("false");
    fireEvent.submit(
      screen.getByRole("button", { name: "Generate Recipes with AI" }).closest("form")!,
    );
    expect(startLibrary).toHaveBeenCalledWith({
      personIds: ["p1"],
      servings: 1,
      dinner: { count: 4, diet: "", avoidances: "" },
    });
  });

  it("does not attach a datalist to the custom diet field", () => {
    render(<LibraryGenerateForm people={[alex]} />);
    const diet = screen.getByPlaceholderText("or type your own");
    expect(diet.getAttribute("list")).toBeNull();
    expect(diet.hasAttribute("required")).toBe(false);
  });

  it("shows people as selectable cards with a Select all control", () => {
    const sam: Person = {
      id: "p2",
      name: "Sam",
      age: 8,
      sex: "male",
      allergies: ["peanuts"],
      avoidances: ["cilantro"],
    };
    render(<LibraryGenerateForm people={[alex, sam]} />);
    expect(screen.getByRole("checkbox", { name: /alex/i })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /sam/i })).toBeTruthy();
    expect(screen.getByText("peanuts · cilantro")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /alex/i }));
    expect((screen.getByRole("checkbox", { name: /alex/i }) as HTMLInputElement).checked).toBe(
      false,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect((screen.getByRole("checkbox", { name: /alex/i }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect((screen.getByRole("checkbox", { name: /sam/i }) as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
