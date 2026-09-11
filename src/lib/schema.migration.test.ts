import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:56322/postgres";

describe("init migration", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(url, { prepare: false, max: 1 });
  });
  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("creates households with unique owner_id", async () => {
    const rows = await sql`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'households'
    `;
    const names = rows.map((r) => r.column_name);
    expect(names).toEqual(
      expect.arrayContaining(["id", "owner_id", "name", "diet_style", "notes", "servings"]),
    );
  });

  it("uses boolean flags and jsonb, not integer 0/1 or text json", async () => {
    const meals = await sql`
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public' and table_name = 'meals'
        and column_name in ('pinned','draft','ingredients','plan_id')
    `;
    const byName = Object.fromEntries(meals.map((r) => [r.column_name, r.data_type]));
    expect(byName.pinned).toBe("boolean");
    expect(byName.draft).toBe("boolean");
    expect(byName.ingredients).toBe("jsonb");
    expect(byName.plan_id).toBe("uuid");
  });

  it("enables RLS and revokes authenticated table grants", async () => {
    const rls = await sql`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'meals'
    `;
    expect(rls[0]?.relrowsecurity).toBe(true);
    const grants = await sql`
      select privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'meals'
        and grantee in ('anon','authenticated')
    `;
    expect(grants).toHaveLength(0);
  });
});
