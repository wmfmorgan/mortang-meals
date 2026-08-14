import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { getSettings, saveSettings } from "./settings-repo";

const dbPath = path.join(
  os.tmpdir(),
  `mortang-settings-${crypto.randomUUID()}.db`,
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

describe("settings repo", () => {
  it("defaults web search to off and persists the toggle", () => {
    expect(getSettings().webSearch).toBe(false);
    expect(saveSettings({ webSearch: true }).webSearch).toBe(true);
    expect(getSettings().webSearch).toBe(true);
    expect(saveSettings({ webSearch: false }).webSearch).toBe(false);
  });
});
