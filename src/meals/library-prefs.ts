import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { libraryGeneratePrefs } from "@/lib/schema";

const ID = "default";

export function getLibraryGeneratePrefs(): unknown | null {
  const row = getDb()
    .select()
    .from(libraryGeneratePrefs)
    .where(eq(libraryGeneratePrefs.id, ID))
    .get();
  if (!row) return null;
  try {
    return JSON.parse(row.json) as unknown;
  } catch {
    return null;
  }
}

export function saveLibraryGeneratePrefs(value: unknown): void {
  const db = getDb();
  const json = JSON.stringify(value);
  const existing = db
    .select()
    .from(libraryGeneratePrefs)
    .where(eq(libraryGeneratePrefs.id, ID))
    .get();
  if (existing) {
    db.update(libraryGeneratePrefs)
      .set({ json })
      .where(eq(libraryGeneratePrefs.id, ID))
      .run();
    return;
  }
  db.insert(libraryGeneratePrefs).values({ id: ID, json }).run();
}
