import {
  AISLES,
  type Meal,
  type MealExtras,
  type ShoppingItem,
  type ShoppingList,
} from "@/lib/types";

const UNIT_ALIASES: Record<string, string> = {
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  clove: "clove",
  cloves: "clove",
  "small clove": "clove",
  "large clove": "clove",
  cup: "cup",
  cups: "cup",
  c: "cup",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  lbs: "lb",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  gram: "g",
  grams: "g",
  g: "g",
  can: "can",
  cans: "can",
};

const PREP_PHRASES = [
  "freshly squeezed",
  "freshly ground",
  "roughly chopped",
  "to taste",
];

const PREP_WORDS = new Set([
  "fresh",
  "freshly",
  "chopped",
  "minced",
  "sliced",
  "diced",
  "ripe",
  "melted",
  "unsalted",
]);

const STOP_WORDS = new Set([
  ...PREP_WORDS,
  "or",
  "and",
  "and/or",
  "such",
  "as",
  "herbs",
  "extra",
  "virgin",
  "the",
  "a",
  "an",
  "of",
  "with",
  "for",
  "to",
  "taste",
  "ground",
]);

const FORM_WORDS = new Set([
  "powder",
  "flake",
  "flakes",
  "salt",
  "zest",
  "juice",
  "stock",
  "broth",
  "sauce",
  "extract",
  "oil",
]);

const VOLUME_TO_TSP: Record<string, number> = {
  tsp: 1,
  tbsp: 3,
  cup: 48,
};

const MASS_TO_G: Record<string, number> = {
  g: 1,
  oz: 28.3495,
  lb: 453.592,
};

function stripTrailingPlural(word: string): string {
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

export function canonicalUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase().replace(/\s+/g, " ");
  return UNIT_ALIASES[normalized] ?? normalized;
}

function isListName(name: string): boolean {
  return /\bsuch as\b|\bor\b|\band\/or\b/.test(name);
}

export function normalizeIngredientName(name: string): string {
  let normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
  normalized = normalized.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (isListName(normalized)) {
    normalized = normalized.replace(/,/g, " ");
  } else {
    normalized = normalized.replace(/,.*$/, "").trim();
  }
  for (const phrase of PREP_PHRASES) {
    normalized = normalized.replaceAll(phrase, " ");
  }
  normalized = normalized.replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  const kept = words.filter((word) => !PREP_WORDS.has(word));
  if (kept.length === 0) return normalized;
  const last = kept[kept.length - 1];
  if (last) kept[kept.length - 1] = stripTrailingPlural(last);
  return kept.join(" ");
}

export function nameTokens(name: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of name.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (STOP_WORDS.has(raw)) continue;
    tokens.add(stripTrailingPlural(raw));
  }
  return tokens;
}

function setEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function subset(small: Set<string>, large: Set<string>): boolean {
  for (const item of small) if (!large.has(item)) return false;
  return true;
}

function formsOf(tokens: Set<string>): Set<string> {
  return new Set([...tokens].filter((token) => FORM_WORDS.has(token)));
}

function coresOf(tokens: Set<string>): Set<string> {
  return new Set([...tokens].filter((token) => !FORM_WORDS.has(token)));
}

export function sameProduct(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return a === b;
  const fa = formsOf(ta);
  const fb = formsOf(tb);
  if (!setEqual(fa, fb)) return false;
  const ca = coresOf(ta);
  const cb = coresOf(tb);
  if (ca.size === 0 && cb.size === 0) return true;
  if (isListName(a) || isListName(b)) {
    for (const token of ca) if (cb.has(token)) return true;
    return false;
  }
  return setEqual(ca, cb) || subset(ca, cb) || subset(cb, ca);
}

function unitFamily(unit: string): "volume" | "mass" | "other" {
  if (unit in VOLUME_TO_TSP) return "volume";
  if (unit in MASS_TO_G) return "mass";
  return "other";
}

function toBase(quantity: number, unit: string): { family: "volume" | "mass"; base: number } | null {
  if (unit in VOLUME_TO_TSP) return { family: "volume", base: quantity * VOLUME_TO_TSP[unit]! };
  if (unit in MASS_TO_G) return { family: "mass", base: quantity * MASS_TO_G[unit]! };
  return null;
}

function fromVolumeTsp(tsp: number): { quantity: string; unit: string } {
  if (tsp >= 48 - 1e-6) {
    return { quantity: formatQuantity(tsp / 48), unit: "cup" };
  }
  if (tsp >= 3 - 1e-6) {
    return { quantity: formatQuantity(tsp / 3), unit: "tbsp" };
  }
  return { quantity: formatQuantity(tsp), unit: "tsp" };
}

function fromMassG(grams: number): { quantity: string; unit: string } {
  if (grams >= 453.592 - 0.05) {
    return { quantity: formatQuantity(grams / 453.592), unit: "lb" };
  }
  if (grams >= 28.3495 - 0.05) {
    return { quantity: formatQuantity(grams / 28.3495), unit: "oz" };
  }
  return { quantity: formatQuantity(grams), unit: "g" };
}

function addQuantities(
  existing: ShoppingItem,
  quantity: number,
  unit: string,
): boolean {
  const current = parseQuantity(existing.quantity);
  if (current == null) return false;
  if (existing.unit === unit) {
    existing.quantity = formatQuantity(current + quantity);
    return true;
  }
  const left = toBase(current, existing.unit);
  const right = toBase(quantity, unit);
  if (!left || !right || left.family !== right.family) return false;
  const combined = left.base + right.base;
  const next =
    left.family === "volume" ? fromVolumeTsp(combined) : fromMassG(combined);
  existing.quantity = next.quantity;
  existing.unit = next.unit;
  return true;
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
    [2 / 3, "2/3"],
    [0.5, "1/2"],
    [1 / 3, "1/3"],
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

function extraRecipeIngredients(
  extras: MealExtras | undefined,
): Meal["ingredients"] {
  const items: Meal["ingredients"] = [];
  for (const extra of [extras?.side, extras?.dessert]) {
    if (extra?.mode === "recipe") items.push(...extra.ingredients);
  }
  return items;
}

export function mergeShoppingList(
  meals: Array<
    Pick<Meal, "ingredients"> & {
      extras?: MealExtras;
      takeout?: boolean;
      leftover?: boolean;
    }
  >,
): ShoppingList {
  const merged: ShoppingItem[] = [];

  for (const meal of meals) {
    if (meal.takeout || meal.leftover) continue;
    const ingredients = [
      ...meal.ingredients,
      ...extraRecipeIngredients(meal.extras),
    ];
    for (const ingredient of ingredients) {
      const name = normalizeIngredientName(ingredient.name);
      const unit = canonicalUnit(ingredient.unit);
      const parsed = parseQuantity(ingredient.quantity);
      const quantityText = String(ingredient.quantity).trim();
      const existing = merged.find(
        (item) =>
          sameProduct(item.name, name) &&
          (item.unit === unit ||
            (parsed != null &&
              unitFamily(item.unit) !== "other" &&
              unitFamily(unit) !== "other" &&
              unitFamily(item.unit) === unitFamily(unit))),
      );
      if (existing && parsed != null && addQuantities(existing, parsed, unit)) {
        if (name.length < existing.name.length) existing.name = name;
        continue;
      }
      if (existing && parsed == null && existing.unit === unit) {
        continue;
      }
      merged.push({
        name,
        quantity: parsed == null ? quantityText : formatQuantity(parsed),
        unit,
        aisle: ingredient.aisle,
      });
    }
  }

  const byAisle = new Map<string, ShoppingItem[]>();
  for (const item of merged) {
    const items = byAisle.get(item.aisle) ?? [];
    items.push(item);
    byAisle.set(item.aisle, items);
  }

  return AISLES.filter((aisle) => byAisle.has(aisle)).map((aisle) => ({
    aisle,
    items: byAisle.get(aisle)!,
  }));
}
