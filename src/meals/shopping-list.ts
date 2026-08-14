import { AISLES, type Meal, type ShoppingItem, type ShoppingList } from "@/lib/types";

export function normalizeIngredientName(name: string): string {
  const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  const words = normalized.split(" ");
  const last = words[words.length - 1];
  if (last && last.length > 3 && last.endsWith("s") && !last.endsWith("ss")) {
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(" ");
}

export function parseQuantity(raw: string | number): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const text = raw.trim().toLowerCase();
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return whole + num / den;
  }
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (den === 0) return null;
    return num / den;
  }
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  return null;
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs + 1e-9);
  const frac = abs - whole;
  const parts: string[] = [];
  if (whole > 0) parts.push(String(whole));
  const named: [number, string][] = [
    [0.75, "3/4"],
    [0.5, "1/2"],
    [0.25, "1/4"],
    [0.125, "1/8"],
  ];
  for (const [amount, label] of named) {
    if (Math.abs(frac - amount) < 1e-6) {
      parts.push(label);
      return sign + parts.join(" ");
    }
  }
  if (frac < 1e-6) return sign + (parts[0] ?? "0");
  const rounded = Math.round(abs * 100) / 100;
  return sign + String(rounded);
}

export function mergeShoppingList(
  meals: Pick<Meal, "ingredients">[],
): ShoppingList {
  const merged = new Map<string, ShoppingItem>();

  for (const meal of meals) {
    for (const ingredient of meal.ingredients) {
      const name = normalizeIngredientName(ingredient.name);
      const parsed = parseQuantity(ingredient.quantity);
      const quantityText = String(ingredient.quantity).trim();
      const key =
        parsed == null
          ? `${name}|${ingredient.unit}|${quantityText}`
          : `${name}|${ingredient.unit}`;
      const existing = merged.get(key);
      if (existing && parsed != null) {
        const current = parseQuantity(existing.quantity);
        existing.quantity = formatQuantity((current ?? 0) + parsed);
      } else if (!existing) {
        merged.set(key, {
          name,
          quantity: parsed == null ? quantityText : formatQuantity(parsed),
          unit: ingredient.unit,
          aisle: ingredient.aisle,
        });
      }
    }
  }

  const byAisle = new Map<string, ShoppingItem[]>();
  for (const item of merged.values()) {
    const items = byAisle.get(item.aisle) ?? [];
    items.push(item);
    byAisle.set(item.aisle, items);
  }

  return AISLES.filter((aisle) => byAisle.has(aisle)).map((aisle) => ({
    aisle,
    items: byAisle.get(aisle)!,
  }));
}
