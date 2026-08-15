import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import {
  getKitchenPrefs,
  resolvedDiet,
  saveKitchenPrefs,
} from "./prefs-repo";

const dbPath = path.join(
  os.tmpdir(),
  `mortang-kitchen-prefs-${crypto.randomUUID()}.db`,
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

describe("kitchen prefs", () => {
  it("defaults then persists a patch", () => {
    expect(getKitchenPrefs().expertise).toBe("intermediate");
    expect(getKitchenPrefs().maxCookMinutes).toBe(45);
    const saved = saveKitchenPrefs({
      expertise: "newbie",
      maxCookMinutes: 25,
      dinnerDiet: "vegetarian",
    });
    expect(saved.expertise).toBe("newbie");
    expect(getKitchenPrefs().dinnerDiet).toBe("vegetarian");
    expect(getKitchenPrefs().maxCookMinutes).toBe(25);
  });

  it("resolves slot diet from override, then overall, then household", () => {
    const prefs = saveKitchenPrefs({
      overallDiet: "Mediterranean",
      breakfastDiet: "high-protein",
      lunchDiet: "",
      dinnerDiet: "",
    });
    expect(resolvedDiet(prefs, "breakfast", "fallback")).toBe("high-protein");
    expect(resolvedDiet(prefs, "lunch", "fallback")).toBe("Mediterranean");
    expect(resolvedDiet({ ...prefs, overallDiet: "" }, "dinner", "fallback")).toBe(
      "fallback",
    );
  });
});
