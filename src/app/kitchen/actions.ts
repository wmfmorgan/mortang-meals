"use server";

import { revalidatePath } from "next/cache";
import { saveKitchenPrefs } from "@/kitchen/prefs-repo";
import {
  addCustomKitchenItem as persistCustomItem,
  setKitchenEnabled as persistEnabled,
} from "@/kitchen/repo";
import type { KitchenItem, KitchenPrefs } from "@/lib/types";

function revalidateKitchen() {
  revalidatePath("/kitchen");
  revalidatePath("/setup");
}

export async function setKitchenEnabled(id: string, enabled: boolean) {
  persistEnabled(id, enabled);
  revalidateKitchen();
}

export async function addCustomKitchenItem(
  name: string,
  kind: KitchenItem["kind"],
) {
  const item = persistCustomItem(name.trim(), kind);
  revalidateKitchen();
  return item;
}

export async function saveKitchenPrefsAction(prefs: KitchenPrefs) {
  const saved = saveKitchenPrefs(prefs);
  revalidateKitchen();
  revalidatePath("/");
  return saved;
}

export async function saveKitchenEnabledStates(
  items: { id: string; enabled: boolean }[],
) {
  for (const item of items) {
    persistEnabled(item.id, item.enabled);
  }
  revalidateKitchen();
}
