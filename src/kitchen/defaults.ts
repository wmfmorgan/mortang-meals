import type { KitchenItem } from "@/lib/types";

export const BUILTIN_KITCHEN_ITEMS: Omit<KitchenItem, "id">[] = [
  { name: "crockpot", kind: "appliance", enabled: true, builtIn: true },
  { name: "air fryer", kind: "appliance", enabled: true, builtIn: true },
  { name: "Instant Pot", kind: "appliance", enabled: true, builtIn: true },
  { name: "oven", kind: "appliance", enabled: true, builtIn: true },
  { name: "stovetop", kind: "appliance", enabled: true, builtIn: true },
  { name: "sheet pan", kind: "method", enabled: true, builtIn: true },
  { name: "grill", kind: "method", enabled: true, builtIn: true },
];
