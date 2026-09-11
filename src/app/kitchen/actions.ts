"use server";

import { revalidatePath } from "next/cache";
import { saveKitchenPrefs } from "@/kitchen/prefs-repo";
import {
  addCustomKitchenItem as persistCustomItem,
  setKitchenEnabled as persistEnabled,
} from "@/kitchen/repo";
import { requirePageHousehold } from "@/lib/request-auth";
import type { KitchenItem, KitchenPrefs } from "@/lib/types";

function revalidateKitchen() {
  revalidatePath("/kitchen");
  revalidatePath("/setup");
}

export async function setKitchenEnabled(id: string, enabled: boolean) {
  const { householdId } = await requirePageHousehold();
  await persistEnabled(householdId, id, enabled);
  revalidateKitchen();
}

export async function addCustomKitchenItem(
  name: string,
  kind: KitchenItem["kind"],
) {
  const { householdId } = await requirePageHousehold();
  const item = await persistCustomItem(householdId, name.trim(), kind);
  revalidateKitchen();
  return item;
}

export async function saveKitchenPrefsAction(prefs: KitchenPrefs) {
  const { householdId } = await requirePageHousehold();
  const saved = await saveKitchenPrefs(householdId, prefs);
  revalidateKitchen();
  revalidatePath("/");
  return saved;
}

export async function saveKitchenEnabledStates(
  items: { id: string; enabled: boolean }[],
) {
  const { householdId } = await requirePageHousehold();
  for (const item of items) {
    await persistEnabled(householdId, item.id, item.enabled);
  }
  revalidateKitchen();
}
