import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { kitchenItems } from "@/lib/schema";
import type { KitchenItem } from "@/lib/types";
import { BUILTIN_KITCHEN_ITEMS } from "./defaults";

type KitchenRow = typeof kitchenItems.$inferSelect;

function mapKitchenItem(row: KitchenRow): KitchenItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as KitchenItem["kind"],
    enabled: row.enabled,
    builtIn: row.builtIn,
  };
}

export async function listKitchen(
  householdId: string,
): Promise<KitchenItem[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(kitchenItems)
    .where(eq(kitchenItems.householdId, householdId));
  return rows.map(mapKitchenItem);
}

export async function seedKitchenIfEmpty(householdId: string): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ id: kitchenItems.id })
    .from(kitchenItems)
    .where(eq(kitchenItems.householdId, householdId))
    .limit(1);
  if (existing) return;
  await db.insert(kitchenItems).values(
    BUILTIN_KITCHEN_ITEMS.map((item) => ({
      householdId,
      name: item.name,
      kind: item.kind,
      enabled: item.enabled,
      builtIn: item.builtIn,
    })),
  );
}

export async function setKitchenEnabled(
  householdId: string,
  id: string,
  enabled: boolean,
): Promise<void> {
  const db = getDb();
  await db
    .update(kitchenItems)
    .set({ enabled })
    .where(
      and(eq(kitchenItems.householdId, householdId), eq(kitchenItems.id, id)),
    );
}

export async function addCustomKitchenItem(
  householdId: string,
  name: string,
  kind: KitchenItem["kind"],
): Promise<KitchenItem> {
  const db = getDb();
  const [row] = await db
    .insert(kitchenItems)
    .values({
      householdId,
      name,
      kind,
      enabled: true,
      builtIn: false,
    })
    .returning();
  if (!row) {
    throw new Error("Kitchen item insert failed");
  }
  return mapKitchenItem(row);
}
