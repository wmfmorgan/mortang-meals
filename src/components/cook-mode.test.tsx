// @vitest-environment happy-dom
import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Meal, Person } from "@/lib/types";
import { EMPTY_EXTRAS } from "@/meals/extras";
import { CookMode } from "./cook-mode";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.useRealTimers();
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
  steps: ["Preheat the oven to 425", "Roast until the flesh flakes"],
  usedWebSearch: false,
  pinned: false,
  createdAt: "2026-08-10T12:00:00.000Z",
  sourceUrl: null,
  imageUrl: null,
  extras: EMPTY_EXTRAS,
  draft: false,
  stars: 4,
  takeout: false,
  leftover: false,
  servings: 2,
};

const ada: Person = {
  id: "ada",
  name: "Ada",
  age: 8,
  sex: null,
  allergies: [],
  avoidances: [],
};

function renderCook(overrides: Partial<ComponentProps<typeof CookMode>> = {}) {
  return render(
    <CookMode
      meal={meal}
      people={[]}
      canSwap={false}
      actions={<button type="button">Edit</button>}
      {...overrides}
    />,
  );
}

describe("CookMode", () => {
  it("renders the title and Mise en Place", () => {
    renderCook();
    expect(
      screen.getByRole("heading", { name: /lemon herb salmon/i }),
    ).toBeTruthy();
    expect(screen.getByText("Mise en Place")).toBeTruthy();
  });

  it("counts checked ingredients as Ready", () => {
    renderCook();
    expect(screen.getByText("0 of 1 Ready")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("1 of 1 Ready")).toBeTruthy();
  });

  it("shows the first step and advances with Next", () => {
    const { container } = renderCook();
    expect(container.querySelector(".cook-instruction")?.textContent).toBe(
      "Preheat the oven to 425",
    );
    expect(
      screen
        .getByRole("button", { name: "1. Preheat the oven to 425" })
        .getAttribute("aria-current"),
    ).toBe("step");

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(container.querySelector(".cook-instruction")?.textContent).toBe(
      "Roast until the flesh flakes",
    );
    expect(
      screen
        .getByRole("button", { name: "2. Roast until the flesh flakes" })
        .getAttribute("aria-current"),
    ).toBe("step");
    expect(
      screen
        .getByRole("button", { name: "1. Preheat the oven to 425" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("disables Prev on the first step and Next on the last", () => {
    renderCook();
    expect(
      (screen.getByRole("button", { name: /previous/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /next/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(
      (screen.getByRole("button", { name: /previous|step 1/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: /next/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("uses a MealImage placeholder when imageUrl is null", () => {
    const { container } = renderCook();
    expect(container.querySelector(".cook-stage-image .meal-image")).toBeTruthy();
    expect(
      container.querySelector(".cook-stage-image .meal-image-placeholder"),
    ).toBeTruthy();
  });

  it("shows whyItFits in a Counter Pro-Tip region", () => {
    renderCook();
    const tip = screen.getByRole("region", { name: "Counter Pro-Tip" });
    expect(tip.textContent).toContain("Counter Pro-Tip");
    expect(tip.textContent).toContain("High-protein Mediterranean");
  });

  it("renders the actions slot", () => {
    renderCook();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("defaults to Step-by-Step and shows one instruction", () => {
    const { container } = renderCook();
    expect(
      screen.getByRole("radio", { name: "Step-by-Step" }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: "All Steps Overview" }).getAttribute("aria-checked"),
    ).toBe("false");
    expect(container.querySelector(".cook-instruction")?.textContent).toBe(
      "Preheat the oven to 425",
    );
    expect(screen.queryByRole("list", { name: "All steps" })).toBeNull();
  });

  it("shows every step after All Steps Overview is selected", () => {
    renderCook();
    fireEvent.click(screen.getByRole("radio", { name: "All Steps Overview" }));
    const list = screen.getByRole("list", { name: "All steps" });
    expect([...list.querySelectorAll("li")].map((item) => item.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Preheat the oven to 425"),
        expect.stringContaining("Roast until the flesh flakes"),
      ]),
    );
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
    expect(sessionStorage.getItem("mortang.cookView.meal-salmon")).toBe(
      JSON.stringify("overview"),
    );
  });

  it("restores All Steps Overview from sessionStorage", async () => {
    sessionStorage.setItem("mortang.cookView.meal-salmon", JSON.stringify("overview"));
    renderCook();
    await vi.waitFor(() => {
      expect(
        screen.getByRole("radio", { name: "All Steps Overview" }).getAttribute("aria-checked"),
      ).toBe("true");
      expect(screen.getByRole("list", { name: "All steps" })).toBeTruthy();
    });
  });

  it("hides the view switch when there are no steps", () => {
    renderCook({ meal: { ...meal, steps: [] } });
    expect(screen.queryByRole("radiogroup", { name: "Cooking view" })).toBeNull();
    expect(screen.getByText("No method steps yet.")).toBeTruthy();
  });

  it("keeps the active step highlighted in overview and after switching back", () => {
    const { container } = renderCook();
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("radio", { name: "All Steps Overview" }));
    expect(
      screen
        .getByRole("button", { name: /2\. Roast until the flesh flakes/i })
        .getAttribute("aria-current"),
    ).toBe("step");

    fireEvent.click(screen.getByRole("button", { name: /1\. Preheat the oven to 425/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Step-by-Step" }));
    expect(container.querySelector(".cook-instruction")?.textContent).toBe(
      "Preheat the oven to 425",
    );
  });

  it("writes checked ingredients to sessionStorage", () => {
    renderCook();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(sessionStorage.getItem("mortang.cookChecks.meal-salmon")).toBe(
      JSON.stringify([0]),
    );
  });

  it("restores checks and the active step from sessionStorage", async () => {
    sessionStorage.setItem("mortang.cookChecks.meal-salmon", JSON.stringify([0]));
    sessionStorage.setItem("mortang.cookStep.meal-salmon", JSON.stringify(1));
    renderCook();
    await vi.waitFor(() => {
      expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(
        true,
      );
      expect(screen.getByText("1 of 1 Ready")).toBeTruthy();
      expect(
        screen
          .getByRole("button", { name: "2. Roast until the flesh flakes" })
          .getAttribute("aria-current"),
      ).toBe("step");
    });
  });

  it("clamps an invalid stored step index to 0", async () => {
    sessionStorage.setItem("mortang.cookStep.meal-salmon", JSON.stringify(99));
    const { container } = renderCook();
    await vi.waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "1. Preheat the oven to 425" })
          .getAttribute("aria-current"),
      ).toBe("step");
    });
    expect(container.querySelector(".cook-instruction")?.textContent).toBe(
      "Preheat the oven to 425",
    );
  });

  it("shows empty-steps copy and no Next", () => {
    renderCook({ meal: { ...meal, steps: [] } });
    expect(screen.getByText("No method steps yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
    expect(screen.getByRole("list", { name: "Full method" })).toBeTruthy();
  });

  it("renders a print-only list of every ingredient and numbered step", () => {
    const { container } = renderCook();
    const method = screen.getByRole("list", { name: "Full method" });
    const print = method.closest(".cook-print-only");
    expect(print).toBeTruthy();
    expect([...method.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "Preheat the oven to 425",
      "Roast until the flesh flakes",
    ]);
    expect(print!.textContent).toContain("1 lb salmon");
    expect(container.querySelector(".cook-exit")?.classList.contains("no-print")).toBe(
      true,
    );
    expect(container.querySelector(".cook-ings")?.closest(".no-print")).toBeTruthy();
    expect(
      container.querySelector(".cook-stage-card")?.classList.contains("no-print"),
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(container.querySelector(".cook-instruction")?.textContent).toBe(
      "Roast until the flesh flakes",
    );
    expect([...method.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "Preheat the oven to 425",
      "Roast until the flesh flakes",
    ]);
  });

  it("hides stars on drafts", () => {
    renderCook({ meal: { ...meal, draft: true } });
    expect(screen.queryByRole("button", { name: "4 stars" })).toBeNull();
  });

  it("calls onRate when a star is clicked", () => {
    const onRate = vi.fn();
    renderCook({ meal: { ...meal, stars: 0 }, onRate });
    fireEvent.click(screen.getByRole("button", { name: "4 stars" }));
    expect(onRate).toHaveBeenCalledWith(4);
  });

  it("scales ingredient quantities with the servings stepper", () => {
    renderCook();
    expect(screen.getByRole("checkbox", { name: "1 lb salmon" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Increase servings" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase servings" }));
    expect(screen.getByRole("checkbox", { name: "2 lb salmon" })).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Full method" }).closest(".cook-print-only")
        ?.textContent,
    ).toContain("2 lb salmon");
  });

  it("shows the allergen ribbon from household people", () => {
    renderCook({ people: [ada] });
    expect(screen.getByText("Allergen safe for Ada.")).toBeTruthy();
  });

  it("requests a screen wake lock on mount and marks Screen Awake pressed", async () => {
    const release = vi.fn();
    const request = vi.fn().mockResolvedValue({ release });
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: { request },
    });

    renderCook();

    expect(screen.getByRole("button", { name: "Screen Awake" })).toBeTruthy();
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledWith("screen");
      expect(
        screen.getByRole("button", { name: "Screen Awake" }).getAttribute(
          "aria-pressed",
        ),
      ).toBe("true");
    });
  });

  it("releases the wake lock when Screen Awake is toggled off", async () => {
    const release = vi.fn();
    const request = vi.fn().mockResolvedValue({ release });
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: { request },
    });

    renderCook();
    await vi.waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Screen Awake" }).getAttribute(
          "aria-pressed",
        ),
      ).toBe("true");
    });

    fireEvent.click(screen.getByRole("button", { name: "Screen Awake" }));

    await vi.waitFor(() => {
      expect(release).toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Screen Awake" }).getAttribute(
          "aria-pressed",
        ),
      ).toBe("false");
    });
  });

  it("re-requests the wake lock when the tab becomes visible", async () => {
    const release = vi.fn();
    const request = vi.fn().mockResolvedValue({ release });
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: { request },
    });

    renderCook();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    request.mockClear();

    document.dispatchEvent(new Event("visibilitychange"));

    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledWith("screen");
    });
  });

  it("releases the wake lock on unmount", async () => {
    const release = vi.fn();
    const request = vi.fn().mockResolvedValue({ release });
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: { request },
    });

    const { unmount } = renderCook();
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith("screen"));

    unmount();

    await vi.waitFor(() => expect(release).toHaveBeenCalled());
  });

  it("keeps Screen Awake visible but inert when wake lock is missing", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: undefined,
    });

    renderCook();
    const button = screen.getByRole("button", { name: "Screen Awake" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("title")).toBe("Not supported on this browser");

    fireEvent.click(button);

    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("retries Screen Awake from a click after a failed mount request", async () => {
    const release = vi.fn();
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("denied"))
      .mockResolvedValue({ release });
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: { request },
    });

    renderCook();
    const button = screen.getByRole("button", { name: "Screen Awake" });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("false"));

    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenLastCalledWith("screen");
      expect(button.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("requests the wake lock from a Screen Awake click when off", async () => {
    const release = vi.fn();
    const request = vi.fn().mockResolvedValue({ release });
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: { request },
    });

    renderCook();
    const button = screen.getByRole("button", { name: "Screen Awake" });
    await vi.waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("true"));
    expect(request).toHaveBeenCalledTimes(1);

    fireEvent.click(button);
    await vi.waitFor(() => expect(button.getAttribute("aria-pressed")).toBe("false"));

    fireEvent.click(button);
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenLastCalledWith("screen");
      expect(button.getAttribute("aria-pressed")).toBe("true");
    });
  });

  it("shows a paused cook timer for cookMinutes and a Play control", () => {
    renderCook();
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "35:00",
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("counts down one second after Play", async () => {
    vi.useFakeTimers();
    renderCook();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "34:59",
    );
  });

  it("resets the timer to cookMinutes and pauses", async () => {
    vi.useFakeTimers();
    renderCook();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "34:59",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "35:00",
    );
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "35:00",
    );
  });

  it("pauses the countdown and stops at 00:00", async () => {
    vi.useFakeTimers();
    renderCook({ meal: { ...meal, cookMinutes: 1 } });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "00:59",
    );

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "00:59",
    );

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "00:00",
    );
    expect(
      (screen.getByRole("button", { name: "Play" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe(
      "00:00",
    );
  });

  it("lets the cook set a custom timer duration in minutes", () => {
    renderCook();
    const input = screen.getByRole("spinbutton", { name: "Timer minutes" }) as HTMLInputElement;
    expect(input.value).toBe("35");

    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.blur(input);

    expect(input.value).toBe("8");
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe("08:00");
    expect(sessionStorage.getItem("mortang.cookTimerMin.meal-salmon")).toBe(
      JSON.stringify(8),
    );
  });

  it("resets to the custom minutes, not cookMinutes", async () => {
    vi.useFakeTimers();
    renderCook();
    const input = screen.getByRole("spinbutton", { name: "Timer minutes" });
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);

    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe("01:59");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe("02:00");
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("clamps typed minutes to 1–180 and pauses if running", async () => {
    vi.useFakeTimers();
    renderCook();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    const input = screen.getByRole("spinbutton", { name: "Timer minutes" });
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("180");
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe("180:00");
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe("1");
    expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe("01:00");
  });

  it("restores custom timer minutes from sessionStorage", async () => {
    sessionStorage.setItem("mortang.cookTimerMin.meal-salmon", JSON.stringify(12));
    renderCook();
    await vi.waitFor(() => {
      expect(
        (screen.getByRole("spinbutton", { name: "Timer minutes" }) as HTMLInputElement)
          .value,
      ).toBe("12");
      expect(screen.getByRole("timer", { name: "Cook timer" }).textContent).toBe("12:00");
    });
  });
});
