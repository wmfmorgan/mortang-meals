import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { listTraces, recordTrace, redactSecrets } from "./traces";

const dbPath = path.join(os.tmpdir(), `mortang-traces-${crypto.randomUUID()}.db`);

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

describe("AI traces", () => {
  it("redacts API keys and Authorization headers", () => {
    expect(redactSecrets("Authorization: Bearer sk-test\nXAI_API_KEY=abc")).not.toContain(
      "sk-test",
    );
    expect(redactSecrets("XAI_API_KEY=abc")).not.toContain("abc");
  });

  it("keeps only the last 25 traces", () => {
    for (let i = 0; i < 26; i++) {
      recordTrace({
        kind: "generate",
        mode: "grok",
        baseUrl: "https://api.x.ai/v1",
        model: "grok-4.6",
        requestText: `req ${i}`,
        responseText: `res ${i}`,
        validation: "ok",
      });
    }
    const rows = listTraces();
    expect(rows).toHaveLength(25);
    expect(rows[0].requestText).toBe("req 25");
  });
});
