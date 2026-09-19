// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Household, KitchenItem, KitchenPrefs } from "@/lib/types";
import { HouseholdKitchenForm } from "./household-kitchen-form";

const saveHouseholdAction = vi.fn(async () => null);
const saveKitchenPrefsAction = vi.fn(async (prefs: KitchenPrefs) => prefs);
const setKitchenEnabled = vi.fn(async () => undefined);
const addCustomKitchenItem = vi.fn();

vi.mock("./actions", () => ({
  saveHouseholdAction: (...args: unknown[]) => saveHouseholdAction(...args),
}));

vi.mock("@/app/kitchen/actions", () => ({
  saveKitchenPrefsAction: (...args: unknown[]) =>
    saveKitchenPrefsAction(...args),
  setKitchenEnabled: (...args: unknown[]) => setKitchenEnabled(...args),
  addCustomKitchenItem: (...args: unknown[]) => addCustomKitchenItem(...args),
}));

afterEach(() => {
  cleanup();
  saveHouseholdAction.mockClear();
  saveKitchenPrefsAction.mockClear();
  setKitchenEnabled.mockClear();
  addCustomKitchenItem.mockClear();
});

const household: Household = {
  id: "hh-1",
  name: "Morgans",
  dietStyle: "",
  notes: "Weeknight dinners",
  servings: 2,
  people: [
    {
      id: "p1",
      name: "Will",
      age: 40,
      sex: "male",
      allergies: [],
      avoidances: ["cilantro"],
    },
  ],
};

const prefs: KitchenPrefs = {
  expertise: "intermediate",
  involved: "medium",
  maxCookMinutes: 45,
  overallDiet: "",
  breakfastDiet: "",
  lunchDiet: "",
  dinnerDiet: "",
};

const items: KitchenItem[] = [
  {
    id: "k1",
    name: "crockpot",
    kind: "appliance",
    enabled: true,
    builtIn: true,
  },
  {
    id: "k2",
    name: "grill",
    kind: "method",
    enabled: false,
    builtIn: true,
  },
];

describe("HouseholdKitchenForm", () => {
  it("saves household and kitchen prefs together", async () => {
    render(
      <HouseholdKitchenForm
        household={household}
        items={items}
        prefs={prefs}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Save Changes" })[0]!);

    await waitFor(() => {
      expect(saveHouseholdAction).toHaveBeenCalled();
      expect(saveKitchenPrefsAction).toHaveBeenCalled();
    });

    expect(saveHouseholdAction.mock.calls[0]?.[0]).toMatchObject({
      name: "Morgans",
      notes: "Weeknight dinners",
    });
    expect(saveKitchenPrefsAction.mock.calls[0]?.[0]).toMatchObject({
      expertise: "intermediate",
      involved: "medium",
      maxCookMinutes: 45,
      overallDiet: "",
    });
    expect(screen.getByText("Saved.")).toBeTruthy();
  });

  it("toggles kitchen items immediately", async () => {
    render(
      <HouseholdKitchenForm
        household={household}
        items={items}
        prefs={prefs}
      />,
    );

    const grill = screen.getByRole("checkbox", { name: /grill/i });
    fireEvent.click(grill);

    await waitFor(() => {
      expect(setKitchenEnabled).toHaveBeenCalledWith("k2", true);
    });
  });

  it("adds a blank person from the top action", () => {
    render(
      <HouseholdKitchenForm
        household={household}
        items={items}
        prefs={prefs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(screen.getByText("Person 2")).toBeTruthy();
  });
});
