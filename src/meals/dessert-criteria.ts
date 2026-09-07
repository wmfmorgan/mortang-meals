export const DESSERT_CRITERIA = [
  "low-sugar",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "egg-free",
  "refined-sugar-free",
  "keto",
] as const;

export type DessertCriterion = (typeof DESSERT_CRITERIA)[number];

export const DEFAULT_DESSERT_DIET = "low-sugar, gluten-free, dairy-free";

const DETAILS: Record<
  DessertCriterion,
  { rule: string; excludes: string[] }
> = {
  "low-sugar": {
    rule: "Keep sugar low: no added sugar, honey, maple syrup, agave, or corn syrup.",
    excludes: ["sugar", "honey", "maple syrup", "agave", "corn syrup"],
  },
  "gluten-free": {
    rule: "Gluten-free: no wheat, barley, rye, or all-purpose flour.",
    excludes: ["wheat", "barley", "rye", "all-purpose flour"],
  },
  "dairy-free": {
    rule: "Dairy-free: no milk, butter, cream, cheese, yogurt, or whey.",
    excludes: ["milk", "butter", "cream", "cheese", "yogurt", "whey"],
  },
  "nut-free": {
    rule: "Nut-free: no tree nuts or peanuts.",
    excludes: [
      "almond",
      "peanut",
      "walnut",
      "pecan",
      "cashew",
      "hazelnut",
      "pistachio",
    ],
  },
  "egg-free": {
    rule: "Egg-free: no eggs.",
    excludes: ["egg"],
  },
  "refined-sugar-free": {
    rule: "No refined sugar or corn syrup.",
    excludes: ["sugar", "brown sugar", "corn syrup"],
  },
  keto: {
    rule: "Keto dessert: very low carb, no grain flours or added sugar.",
    excludes: [],
  },
};

export function parseDessertCriteria(diet: string): DessertCriterion[] {
  const tokens = diet
    .split(/[,;\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return DESSERT_CRITERIA.filter((item) => tokens.includes(item));
}

export function dessertCriteriaFromDiet(diet: string): {
  rules: string[];
  excludes: string[];
} {
  const selected = parseDessertCriteria(diet);
  const excludes = new Set<string>();
  const rules: string[] = [];
  for (const item of selected) {
    const detail = DETAILS[item];
    rules.push(detail.rule);
    for (const name of detail.excludes) excludes.add(name);
  }
  return { rules, excludes: [...excludes] };
}

export function toggleDessertCriterion(diet: string, criterion: string): string {
  const selected = new Set(parseDessertCriteria(diet));
  if (selected.has(criterion as DessertCriterion)) {
    selected.delete(criterion as DessertCriterion);
  } else if ((DESSERT_CRITERIA as readonly string[]).includes(criterion)) {
    selected.add(criterion as DessertCriterion);
  }
  return DESSERT_CRITERIA.filter((item) => selected.has(item)).join(", ");
}
