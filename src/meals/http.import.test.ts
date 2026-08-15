import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { handleImportRecipe, handleUpdateMeal } from "./http";
import { getMeal } from "./repo";

const dbPath = path.join(
  os.tmpdir(),
  `mortang-import-${crypto.randomUUID()}.db`,
);

beforeAll(() => {
  process.env.MORTANG_DB_PATH = dbPath;
  resetDbForTests();
});

afterAll(() => {
  resetDbForTests();
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }
});

describe("handleImportRecipe", () => {
  it("saves a normal meal with the source URL", async () => {
    const result = await handleImportRecipe(
      { url: "https://example.com/salmon", slot: "dinner" },
      {
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
      },
    );

    expect(result.status).toBe(200);
    const meal = (result.body as { meal: { id: string } }).meal;
    const saved = getMeal(meal.id);
    expect(saved?.title).toBe("Imported salmon");
    expect(saved?.sourceUrl).toBe("https://example.com/salmon");
    expect(saved?.slot).toBe("dinner");
  });

  it("emits opening, writing, and saving progress", async () => {
    const phases: string[] = [];
    await handleImportRecipe(
      { url: "https://example.com/salmon", slot: "dinner" },
      {
        onProgress: (event) => {
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
      },
    );
    expect(phases).toEqual(["opening", "writing", "saving"]);
  });
});

describe("handleUpdateMeal", () => {
  it("rejects an empty title", async () => {
    const imported = await handleImportRecipe(
      { url: "https://example.com/stew", slot: "lunch" },
      {
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
      },
    );
    const meal = (imported.body as { meal: { id: string } }).meal;
    const result = handleUpdateMeal({
      mealId: meal.id,
      title: "",
      whyItFits: "Hearty",
      cookMinutes: 40,
      method: "pot",
      ingredients: [{ name: "beef", quantity: "1", unit: "lb", aisle: "meat" }],
      steps: ["Simmer"],
    });
    expect(result.status).toBe(400);
  });
});
