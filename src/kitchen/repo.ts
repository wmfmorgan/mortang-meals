import { eq } from "drizzle-orm";
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
    enabled: row.enabled === 1,
    builtIn: row.builtIn === 1,
  };
}

export function listKitchen(): KitchenItem[] {
  const db = getDb();
  return db.select().from(kitchenItems).all().map(mapKitchenItem);
}

export function seedKitchenIfEmpty(): void {
  const db = getDb();
  const existing = db.select({ id: kitchenItems.id }).from(kitchenItems).get();
  if (existing) return;
  db.insert(kitchenItems)
    .values(
      BUILTIN_KITCHEN_ITEMS.map((item) => ({
        id: crypto.randomUUID(),
        name: item.name,
        kind: item.kind,
        enabled: item.enabled ? 1 : 0,
        builtIn: item.builtIn ? 1 : 0,
      })),
    )
    .run();
}

export function setKitchenEnabled(id: string, enabled: boolean): void {
  const db = getDb();
  db.update(kitchenItems)
    .set({ enabled: enabled ? 1 : 0 })
    .where(eq(kitchenItems.id, id))
    .run();
}

export function addCustomKitchenItem(
  name: string,
  kind: "appliance" | "method",
): KitchenItem {
  const db = getDb();
  const row = {
    id: crypto.randomUUID(),
    name,
    kind,
    enabled: 1,
    builtIn: 0,
  };
  db.insert(kitchenItems).values(row).run();
  return mapKitchenItem(row);
}
