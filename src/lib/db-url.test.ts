import { describe, expect, it } from "vitest";
import { preferTransactionPooler, resolveDatabaseUrl } from "./db-url";

describe("preferTransactionPooler", () => {
  it("rewrites Supabase session pooler :5432 to transaction :6543", () => {
    const input =
      "postgresql://postgres.abc:secret@aws-0-us-east-1.pooler.supabase.com:5432/postgres";
    const out = preferTransactionPooler(input);
    expect(out).toContain(":6543/");
    expect(out).toContain("pgbouncer=true");
    expect(out).toContain("postgres.abc");
    expect(out).not.toContain(":5432/");
  });

  it("leaves transaction pooler and direct hosts alone", () => {
    const tx =
      "postgresql://postgres.abc:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
    expect(preferTransactionPooler(tx)).toBe(tx);
    const local = "postgresql://postgres:postgres@127.0.0.1:56322/postgres";
    expect(preferTransactionPooler(local)).toBe(local);
  });
});

describe("resolveDatabaseUrl", () => {
  it("prefers POSTGRES_PRISMA_URL over DATABASE_URL", () => {
    expect(
      resolveDatabaseUrl({
        POSTGRES_PRISMA_URL:
          "postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
        DATABASE_URL:
          "postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
      }),
    ).toContain(":6543/");
  });

  it("rewrites session DATABASE_URL when that is all that is set", () => {
    const out = resolveDatabaseUrl({
      DATABASE_URL:
        "postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    });
    expect(out).toContain(":6543/");
    expect(out).toContain("pgbouncer=true");
  });
});
