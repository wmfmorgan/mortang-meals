/**
 * Pick a Postgres URL for serverless.
 * Prefer the transaction pooler (POSTGRES_PRISMA_URL / :6543) over session
 * pooler (:5432) — session mode caps ~15 clients and fails with EMAXCONNSESSION.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw =
    env.POSTGRES_PRISMA_URL ||
    env.DATABASE_URL ||
    env.POSTGRES_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set (also checked POSTGRES_PRISMA_URL / POSTGRES_URL)",
    );
  }
  return preferTransactionPooler(raw);
}

/** Rewrite Supabase session-pooler URLs to transaction mode for serverless. */
export function preferTransactionPooler(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (!parsed.hostname.includes("pooler.supabase.com")) return url;
  const port = parsed.port || "5432";
  if (port !== "5432") return url;

  parsed.port = "6543";
  if (!parsed.searchParams.has("pgbouncer")) {
    parsed.searchParams.set("pgbouncer", "true");
  }
  return parsed.toString();
}
