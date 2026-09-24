// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Person } from "@/lib/types";
import { RECIPE_SLOTS } from "@/lib/types";
import { AddRecipeModal } from "./add-recipe-modal";
import { LEAVE_RECIPE_MESSAGE } from "./meal-detail";

const startImport = vi.hoisted(() => vi.fn());
const startLibrary = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("./generation-provider", () => ({
  useGeneration: () => ({
    state: { status: "idle", kind: "library" },
    startImport,
    startLibrary,
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  startImport.mockReset();
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

const leo: Person = {
  id: "p2",
  name: "Leo",
  age: 8,
  sex: "male",
  allergies: ["peanuts"],
  avoidances: [],
};

const maya: Person = {
  id: "p3",
  name: "Maya",
  age: 5,
  sex: "female",
  allergies: ["gluten", "peanuts"],
  avoidances: ["cilantro"],
};

function renderModal(
  overrides: Partial<ComponentProps<typeof AddRecipeModal>> = {},
) {
  const props = {
    people: [alex],
    servings: 2,
    onClose: vi.fn(),
    ...overrides,
  };
  const view = render(<AddRecipeModal {...props} />);
  return { ...view, ...props };
}

describe("AddRecipeModal chooser", () => {
  it("shows Import, Create with AI Chef, and Manual Recipe Entry", () => {
    renderModal();
    expect(screen.getByText("Import from URL")).toBeTruthy();
    expect(screen.getByText("Create with AI Chef")).toBeTruthy();
    expect(screen.getByText("Manual Recipe Entry")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start Blank" })).toBeTruthy();
    expect(screen.getByLabelText("Recipe URL")).toBeTruthy();
    const slot = screen.getByLabelText(/^meal$/i) as HTMLSelectElement;
    expect([...slot.options].map((option) => option.value)).toEqual([
      ...RECIPE_SLOTS,
    ]);
  });

  it("imports a URL then closes", async () => {
    const { onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("Recipe URL"), {
      target: { value: "https://example.com/chili" },
    });
    fireEvent.change(screen.getByLabelText(/^meal$/i), {
      target: { value: "lunch" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await vi.waitFor(() => expect(startImport).toHaveBeenCalledTimes(1));
    expect(startImport).toHaveBeenCalledWith({
      url: "https://example.com/chili",
      slot: "lunch",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape, X, and backdrop without importing", () => {
    const { onClose } = renderModal();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(startImport).not.toHaveBeenCalled();

    onClose.mockClear();
    fireEvent.click(screen.getByTitle("Close modal"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(startImport).not.toHaveBeenCalled();

    onClose.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(startImport).not.toHaveBeenCalled();
  });
});

describe("AddRecipeModal AI", () => {
  it("opens the generate form; Back returns to chooser without closing", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(screen.getByText("Alex")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Generate Recipes with AI" }),
    ).toBeTruthy();
    expect(screen.queryByText("Import from URL")).toBeNull();
    expect(screen.getByRole("button", { name: "Back to options" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Back to options" }));
    expect(screen.getByText("Import from URL")).toBeTruthy();
    expect(screen.getByText("Create with AI Chef")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Generate Recipes with AI" }),
    ).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes after startLibrary is invoked", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    fireEvent.click(screen.getByRole("button", { name: "keto" }));
    fireEvent.submit(
      screen.getByRole("button", { name: "Generate Recipes with AI" }).closest("form")!,
    );
    expect(startLibrary).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("AddRecipeModal manual", () => {
  it("opens the create form; Back returns to chooser without closing", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Start Blank" }));

    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByLabelText(/^title$/i)).toBeTruthy();
    expect(screen.queryByText("Import from URL")).toBeNull();
    expect(screen.getByRole("button", { name: "Back to options" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Back to options" }));
    expect(screen.getByText("Manual Recipe Entry")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes a clean manual form without confirming", () => {
    const confirm = vi.spyOn(window, "confirm");
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Start Blank" }));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it("asks before discarding a dirty form on Escape, X, and backdrop", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Start Blank" }));
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Weeknight chili" },
    });

    fireEvent.keyDown(window, { key: "Escape" });
    expect(confirm).toHaveBeenCalledWith(LEAVE_RECIPE_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^title$/i)).toBeTruthy();

    confirm.mockClear();
    fireEvent.click(screen.getByTitle("Close modal"));
    expect(confirm).toHaveBeenCalledWith(LEAVE_RECIPE_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(confirm).toHaveBeenCalledWith(LEAVE_RECIPE_MESSAGE);
    expect(onClose).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it("asks before Back to options when the manual form is dirty", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Start Blank" }));
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Weeknight chili" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Back to options" }));
    expect(confirm).toHaveBeenCalledWith(LEAVE_RECIPE_MESSAGE);
    expect(screen.getByLabelText(/^title$/i)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Back to options" }));
    expect(screen.getByText("Manual Recipe Entry")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});

describe("AddRecipeModal safety note", () => {
  it("lists unique allergy names from people", () => {
    renderModal({ people: [leo, maya] });
    const note = screen.getByText(/peanuts/i);
    expect(note.textContent).toMatch(/peanuts/i);
    expect(note.textContent).toMatch(/gluten/i);
    expect(note.textContent).not.toMatch(/cilantro/i);
    expect((note.textContent?.match(/peanuts/gi) ?? []).length).toBe(1);
  });

  it("hides the safety note when nobody has allergies", () => {
    renderModal({ people: [alex] });
    expect(screen.queryByText(/allerg/i)).toBeNull();
    expect(screen.queryByText(/peanuts/i)).toBeNull();
  });
});
