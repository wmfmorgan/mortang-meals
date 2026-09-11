import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { kitchenItems, meals, people } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { replacePeople, upsertHousehold } from "@/household/repo";
import { seedKitchenIfEmpty } from "@/kitchen/repo";
import { importSqlite } from "./import-sqlite";

function writeFixture(file: string) {
  const sqlite = new Database(file);
  sqlite.exec(`
    create table households (id text primary key, name text, diet_style text, notes text, servings integer);
    create table meals (
      id text primary key, plan_id text, day text, slot text, title text,
      why_it_fits text, cook_minutes integer, method text,
      ingredients_json text, steps_json text, used_web_search integer,
      pinned integer, week_start text, created_at text, source_url text,
      extras_json text, draft integer, stars integer, takeout integer, leftover integer
    );
  `);
  sqlite.prepare(
    `insert into households values ('h1','Mortang','omnivore','',2)`,
  ).run();
  sqlite.prepare(
    `insert into meals values ('m1','','monday','dinner','Imported stew','fits',30,'pot','[]','[]',0,0,'','2026-01-01T00:00:00.000Z',null,'{}',0,0,0,0)`,
  ).run();
  sqlite.close();
}

describe("importSqlite", () => {
  afterEach(resetDbForTests);

  it("copies sqlite meals onto the email's household", async () => {
    const ident = await createTestIdentity("owner@example.com");
    await upsertHousehold({
      ownerId: ident.userId,
      id: ident.householdId,
      name: "x",
      dietStyle: "x",
      notes: "",
      servings: 1,
    });
    const file = path.join(os.tmpdir(), `import-${crypto.randomUUID()}.db`);
    writeFixture(file);
    const result = await importSqlite({ dbPath: file, email: ident.email });
    expect(result.meals).toBe(1);
    const rows = await getDb().select().from(meals);
    expect(rows[0]?.title).toBe("Imported stew");
    expect(rows[0]?.planId).toBeNull();
    expect(rows[0]?.householdId).toBe(ident.householdId);
    fs.rmSync(file, { force: true });
    await deleteTestUser(ident.userId);
  });

  it("refuses a second import without force", async () => {
    const ident = await createTestIdentity("owner2@example.com");
    await upsertHousehold({
      ownerId: ident.userId,
      id: ident.householdId,
      name: "x",
      dietStyle: "x",
      notes: "",
      servings: 1,
    });
    const file = path.join(os.tmpdir(), `import-${crypto.randomUUID()}.db`);
    writeFixture(file);
    await importSqlite({ dbPath: file, email: ident.email });
    await expect(
      importSqlite({ dbPath: file, email: ident.email }),
    ).rejects.toThrow(/already has meals/i);
    fs.rmSync(file, { force: true });
    await deleteTestUser(ident.userId);
  });

  it("replaces meals when force is set", async () => {
    const ident = await createTestIdentity("owner3@example.com");
    await upsertHousehold({
      ownerId: ident.userId,
      id: ident.householdId,
      name: "x",
      dietStyle: "x",
      notes: "",
      servings: 1,
    });
    const file = path.join(os.tmpdir(), `import-${crypto.randomUUID()}.db`);
    writeFixture(file);
    await importSqlite({ dbPath: file, email: ident.email });
    const result = await importSqlite({
      dbPath: file,
      email: ident.email,
      force: true,
    });
    expect(result.meals).toBe(1);
    const rows = await getDb().select().from(meals);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Imported stew");
    expect(rows[0]?.planId).toBeNull();
    expect(rows[0]?.usedWebSearch).toBe(false);
    fs.rmSync(file, { force: true });
    await deleteTestUser(ident.userId);
  });

  it("keeps setup people and kitchen on first import", async () => {
    const ident = await createTestIdentity();
    const file = path.join(os.tmpdir(), `import-${crypto.randomUUID()}.db`);
    try {
      await upsertHousehold({
        ownerId: ident.userId,
        id: ident.householdId,
        name: "x",
        dietStyle: "x",
        notes: "",
        servings: 1,
      });
      await replacePeople(ident.householdId, [
        {
          name: "Pat",
          age: 40,
          sex: null,
          allergies: [],
          avoidances: [],
        },
      ]);
      await seedKitchenIfEmpty(ident.householdId);
      writeFixture(file);
      const result = await importSqlite({ dbPath: file, email: ident.email });
      expect(result.meals).toBe(1);
      const db = getDb();
      const members = await db.select().from(people);
      expect(members.map((row) => row.name)).toEqual(["Pat"]);
      const items = await db.select().from(kitchenItems);
      expect(items.length).toBeGreaterThan(0);
      const rows = await db.select().from(meals);
      expect(rows[0]?.title).toBe("Imported stew");
      expect(rows[0]?.householdId).toBe(ident.householdId);
    } finally {
      fs.rmSync(file, { force: true });
      await deleteTestUser(ident.userId);
    }
  });
});
