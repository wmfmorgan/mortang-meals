import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { saveSettings } from "@/ai/settings-repo";
import { AI_DAILY_CAP } from "@/ai/usage";
import { resetDbForTests } from "@/lib/db";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import type { AdapterRequest, AdapterResult } from "@/lib/types";
import { handleCreateMeal, handleImportRecipe, handleUpdateMeal } from "./http";
import { getMeal } from "./repo";

let ident: Awaited<ReturnType<typeof createTestIdentity>>;

function deps(extra: {
  complete?: (req: AdapterRequest) => Promise<AdapterResult>;
  onProgress?: (event: { phase: string; message: string }) => void;
} = {}) {
  return {
    auth: { userId: ident.userId, householdId: ident.householdId },
    ...extra,
  };
}

beforeAll(async () => {
  await resetDbForTests();
  ident = await createTestIdentity();
});

afterAll(async () => {
  await resetDbForTests();
  await deleteTestUser(ident.userId);
});

describe("handleImportRecipe", () => {
  it("saves a normal meal with the source URL", async () => {
    const result = await handleImportRecipe(
      { url: "https://example.com/salmon", slot: "dinner" },
      deps({
        complete: async () => ({
          ok: true,
          text: JSON.stringify({
            meal: {
              day: "monday",
              slot: "dinner",
              title: "Imported salmon",
              whyItFits: "From the page",
              cookMinutes: 25,
              method: "sheet pan",
              ingredients: [
                { name: "salmon", quantity: "1", unit: "lb", aisle: "meat" },
              ],
              steps: ["Roast"],
            },
          }),
        }),
      }),
    );

    expect(result.status).toBe(200);
    const meal = (result.body as { meal: { id: string } }).meal;
    const saved = await getMeal(ident.householdId, meal.id);
    expect(saved?.title).toBe("Imported salmon");
    expect(saved?.sourceUrl).toBe("https://example.com/salmon");
    expect(saved?.slot).toBe("dinner");
  });

  it("emits opening, writing, and saving progress", async () => {
    const phases: string[] = [];
    await handleImportRecipe(
      { url: "https://example.com/salmon", slot: "dinner" },
      deps({
        onProgress: (event: { phase: string }) => {
          phases.push(event.phase);
        },
        complete: async () => ({
          ok: true,
          text: JSON.stringify({
            meal: {
              day: "monday",
              slot: "dinner",
              title: "Imported salmon",
              whyItFits: "From the page",
              cookMinutes: 25,
              method: "sheet pan",
              ingredients: [
                { name: "salmon", quantity: "1", unit: "lb", aisle: "meat" },
              ],
              steps: ["Roast"],
            },
          }),
        }),
      }),
    );
    expect(phases).toEqual(["opening", "writing", "saving"]);
  });

  it("counts import against the shared-key cap even with a custom provider key", async () => {
    const other = await createTestIdentity();
    await saveSettings(other.householdId, {
      mode: "custom",
      customApiKey: "sk-test",
    });
    const auth = { userId: other.userId, householdId: other.householdId };
    let calls = 0;
    const complete = async (): Promise<AdapterResult> => {
      calls += 1;
      return {
        ok: true,
        text: JSON.stringify({
          meal: {
            day: "monday",
            slot: "dinner",
            title: `Imported cap ${calls}`,
            whyItFits: "From the page",
            cookMinutes: 25,
            method: "sheet pan",
            ingredients: [
              { name: "salmon", quantity: "1", unit: "lb", aisle: "meat" },
            ],
            steps: ["Roast"],
          },
        }),
      };
    };

    try {
      for (let i = 0; i < AI_DAILY_CAP; i++) {
        const result = await handleImportRecipe(
          { url: `https://example.com/cap-${i}`, slot: "dinner" },
          { auth, complete },
        );
        expect(result.status).toBe(200);
      }
      const eleventh = await handleImportRecipe(
        { url: "https://example.com/cap-over", slot: "dinner" },
        { auth, complete },
      );
      expect(eleventh.status).toBe(429);
      expect((eleventh.body as { message: string }).message).toBe(
        "Daily generate limit reached. Try again tomorrow.",
      );
      expect(calls).toBe(AI_DAILY_CAP);
    } finally {
      await deleteTestUser(other.userId);
    }
  });
});

describe("handleUpdateMeal", () => {
  it("rejects an empty title", async () => {
    const imported = await handleImportRecipe(
      { url: "https://example.com/stew", slot: "lunch" },
      deps({
        complete: async () => ({
          ok: true,
          text: JSON.stringify({
            meal: {
              day: "monday",
              slot: "lunch",
              title: "Stew",
              whyItFits: "Hearty",
              cookMinutes: 40,
              method: "pot",
              ingredients: [
                { name: "beef", quantity: "1", unit: "lb", aisle: "meat" },
              ],
              steps: ["Simmer"],
            },
          }),
        }),
      }),
    );
    const meal = (imported.body as { meal: { id: string } }).meal;
    const result = await handleUpdateMeal(
      {
        mealId: meal.id,
        title: "",
        whyItFits: "Hearty",
        cookMinutes: 40,
        method: "pot",
        ingredients: [{ name: "beef", quantity: "1", unit: "lb", aisle: "meat" }],
        steps: ["Simmer"],
      },
      deps({}),
    );
    expect(result.status).toBe(400);
  });
});

const typedRecipe = {
  title: "Grandma chili",
  whyItFits: "Cold-night staple",
  cookMinutes: 45,
  method: "dutch oven",
  ingredients: [{ name: "beans", quantity: "2", unit: "can", aisle: "pantry" }],
  steps: ["Simmer"],
};

describe("handleCreateMeal", () => {
  it("saves a typed library meal", async () => {
    const result = await handleCreateMeal(
      { ...typedRecipe, slot: "lunch" },
      deps({}),
    );
    expect(result.status).toBe(200);
    const meal = (result.body as { meal: { id: string } }).meal;
    const saved = await getMeal(ident.householdId, meal.id);
    expect(saved?.title).toBe("Grandma chili");
    expect(saved?.slot).toBe("lunch");
    expect(saved?.planId).toBeNull();
    expect(saved?.sourceUrl).toBeNull();
    expect(saved?.usedWebSearch).toBe(false);
  });

  it("rejects an empty title", async () => {
    const result = await handleCreateMeal(
      { ...typedRecipe, title: "", slot: "dinner" },
      deps({}),
    );
    expect(result.status).toBe(400);
  });

  it("rejects a recipe with no ingredients", async () => {
    const result = await handleCreateMeal(
      {
        ...typedRecipe,
        ingredients: [],
        slot: "dinner",
      },
      deps({}),
    );
    expect(result.status).toBe(400);
  });

  it("allows an empty why-it-fits", async () => {
    const result = await handleCreateMeal(
      {
        ...typedRecipe,
        title: "Weeknight beans",
        whyItFits: "",
        slot: "dinner",
      },
      deps({}),
    );
    expect(result.status).toBe(200);
    const meal = (result.body as { meal: { whyItFits: string } }).meal;
    expect(meal.whyItFits).toBe("");
  });

  it("rejects a recipe with no steps", async () => {
    const result = await handleCreateMeal(
      {
        ...typedRecipe,
        steps: [],
        slot: "dinner",
      },
      deps({}),
    );
    expect(result.status).toBe(400);
  });
});
