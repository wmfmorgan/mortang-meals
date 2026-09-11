import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { libraryGeneratePrefs } from "@/lib/schema";

export async function getLibraryGeneratePrefs(
  householdId: string,
): Promise<unknown | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(libraryGeneratePrefs)
    .where(eq(libraryGeneratePrefs.householdId, householdId))
    .limit(1);
  if (!row) return null;
  return row.json;
}

export async function saveLibraryGeneratePrefs(
  householdId: string,
  value: unknown,
): Promise<void> {
  const db = getDb();
  await db
    .insert(libraryGeneratePrefs)
    .values({ householdId, json: value })
    .onConflictDoUpdate({
      target: libraryGeneratePrefs.householdId,
      set: { json: value },
    });
}
