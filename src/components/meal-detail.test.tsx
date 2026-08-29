// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal } from "@/lib/types";
import { MealDetail } from "./meal-detail";

const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  router.refresh.mockReset();
  router.push.mockReset();
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
  steps: ["Roast until the flesh flakes"],
  usedWebSearch: false,
  pinned: false,
  createdAt: "2026-08-10T12:00:00.000Z",
  sourceUrl: null,
};

function renderDetail(overrides: Partial<ComponentProps<typeof MealDetail>> = {}) {
  return render(
    <MealDetail
      meal={meal}
      servings="Serves 4"
      canSwap={false}
      eyebrow="Monday dinner"
      {...overrides}
    />,
  );
}

describe("MealDetail print", () => {
  it("shows a Print recipe control on the recipe page", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: "Print recipe" })).toBeTruthy();
  });

  it("opens the browser print dialog", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    renderDetail();
    screen.getByRole("button", { name: "Print recipe" }).click();
    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });

  it("hides the print control while editing", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: "Print recipe" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("heading", { name: /edit recipe/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Print recipe" })).toBeNull();
  });
});

describe("MealDetail unsaved changes", () => {
  it("does not warn on leave when nothing has changed", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("warns on refresh after an unsaved edit", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Changed title" },
    });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("asks before following a link with unsaved edits", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <div>
        <a href="/meals">Back to meals</a>
        <MealDetail
          meal={meal}
          servings="Serves 4"
          canSwap={false}
          eyebrow="Monday dinner"
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Changed title" },
    });
    const link = screen.getByRole("link", { name: "Back to meals" });
    const event = fireEvent.click(link);
    expect(confirm).toHaveBeenCalled();
    expect(event).toBe(false);
    confirm.mockRestore();
  });
});

describe("MealDetail steps", () => {
  it("uses a drag handle and delete icon instead of up/down/remove", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));

    expect(screen.queryByRole("button", { name: "Up" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Down" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reorder step 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete step 1" })).toBeTruthy();
  });

  it("reorders steps when a row is dropped on another", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Step 2" }), {
      target: { value: "Rest five minutes" },
    });

    fireEvent.dragStart(screen.getByRole("button", { name: "Reorder step 2" }));
    const firstRow = screen
      .getByRole("button", { name: "Reorder step 1" })
      .closest("li");
    fireEvent.drop(firstRow!);

    expect(
      (screen.getByRole("textbox", { name: "Step 1" }) as HTMLTextAreaElement)
        .value,
    ).toBe("Rest five minutes");
    expect(
      (screen.getByRole("textbox", { name: "Step 2" }) as HTMLTextAreaElement)
        .value,
    ).toBe("Roast until the flesh flakes");
  });

  it("deletes a step from the icon", () => {
    renderDetail();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete step 2" }));

    expect(screen.getByRole("textbox", { name: "Step 1" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Step 2" })).toBeNull();
  });
});

describe("MealDetail create", () => {
  it("starts in the add-recipe form without print or delete", () => {
    render(
      <MealDetail
        mode="create"
        servings="Serves 2"
        canSwap={false}
        eyebrow="New recipe"
      />,
    );

    expect(screen.getByRole("heading", { name: /add recipe/i })).toBeTruthy();
    expect(screen.getByLabelText(/^title$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^meal$/i)).toBeTruthy();
    expect(
      (screen.getByLabelText(/^why it fits$/i) as HTMLTextAreaElement).required,
    ).toBe(false);
    expect(screen.queryByRole("button", { name: "Print recipe" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Delete ingredient 1" }),
    ).toBeTruthy();
  });

  it("posts the typed recipe to /api/create", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ meal: { id: "meal-chili" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MealDetail
        mode="create"
        servings="Serves 2"
        canSwap={false}
        eyebrow="New recipe"
      />,
    );

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: "Grandma chili" },
    });
    fireEvent.change(screen.getByLabelText(/^cook minutes$/i), {
      target: { value: "45" },
    });
    fireEvent.change(screen.getByLabelText(/^method$/i), {
      target: { value: "dutch oven" },
    });
    fireEvent.change(screen.getByLabelText(/^meal$/i), {
      target: { value: "lunch" },
    });
    fireEvent.change(screen.getByLabelText(/^qty$/i), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/^unit$/i), {
      target: { value: "can" },
    });
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "beans" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Step 1" }), {
      target: { value: "Simmer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/create");
    const body = JSON.parse(String(init.body)) as {
      title: string;
      slot: string;
      whyItFits: string;
      ingredients: { quantity: string }[];
    };
    expect(body.title).toBe("Grandma chili");
    expect(body.slot).toBe("lunch");
    expect(body.whyItFits).toBe("");
    expect(body.ingredients[0]?.quantity).toBe("2");
    await vi.waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/meals");
    });
  });
});
