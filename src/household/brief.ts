import { resolvedDiet } from "@/kitchen/prefs-repo";
import type {
  Household,
  KitchenItem,
  KitchenPrefs,
  Person,
  Sex,
  SlotMask,
  UseIngredient,
} from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";

function sexLabel(sex: Sex | null): string {
  if (sex === "male") return "man";
  if (sex === "female") return "woman";
  return "person";
}

function describePerson(person: Person): string {
  return `a ${person.age}-year-old ${sexLabel(person.sex)}`;
}

const EXPERTISE_LINES = {
  newbie:
    "Cook for a newbie: simple techniques, no juggling pans, clear steps.",
  novice:
    "Cook for a novice: familiar weeknight methods, light guidance in the steps.",
  intermediate:
    "Cook for an intermediate cook: normal home techniques are fine.",
  expert: "Cook for an expert: advanced technique and tighter timing are fine.",
} as const;

const INVOLVED_LINES = {
  low: "How involved: low — few ingredients, short method, one main vessel.",
  medium: "How involved: medium — a normal weeknight recipe.",
  high: "How involved: high — more components and steps are fine.",
} as const;

export function buildHouseholdBrief(input: {
  household: Household;
  kitchen: KitchenItem[];
  slotMask: SlotMask;
  prefs?: KitchenPrefs;
  useIngredients?: UseIngredient[];
  extraRules?: string[];
}): string {
  const { household, kitchen, slotMask, prefs, useIngredients, extraRules } =
    input;
  const lines: string[] = [];

  const people = household.people.map(describePerson).join(" and ");
  const peopleSentence =
    people.length > 0
      ? people.charAt(0).toUpperCase() + people.slice(1)
      : "";
  const overallDiet =
    prefs?.overallDiet.trim() || household.dietStyle.trim() || "household";
  const diet = `Focusing on a ${overallDiet} diet.`;
  lines.push(peopleSentence ? `${peopleSentence}. ${diet}` : diet);

  if (household.notes.trim()) {
    lines.push(household.notes.trim());
  }

  for (const person of household.people) {
    for (const allergy of person.allergies) {
      lines.push(`Never use ${allergy} (${person.name})`);
    }
  }

  for (const person of household.people) {
    for (const avoidance of person.avoidances) {
      lines.push(`Prefer to avoid ${avoidance} (${person.name})`);
    }
  }

  const enabledKitchen = kitchen.filter((item) => item.enabled).map((item) => item.name);
  if (enabledKitchen.length > 0) {
    lines.push(`Prefer meals that use: ${enabledKitchen.join(", ")}`);
  }

  if (prefs) {
    lines.push(EXPERTISE_LINES[prefs.expertise]);
    lines.push(INVOLVED_LINES[prefs.involved]);
    lines.push(`Keep cookMinutes at or under ${prefs.maxCookMinutes}.`);
    const usedSlots = SLOTS.filter((slot) =>
      DAYS.some((day) => slotMask[day][slot]),
    );
    for (const slot of usedSlots) {
      const dietForSlot = resolvedDiet(prefs, slot, household.dietStyle);
      if (dietForSlot) {
        lines.push(`${slot} diet: ${dietForSlot}.`);
      }
    }
  }

  const slots: string[] = [];
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      if (slotMask[day][slot]) {
        slots.push(`${day} ${slot}`);
      }
    }
  }
  lines.push(`Fill only these slots: ${slots.join(", ")}`);

  if (useIngredients) {
    for (const item of useIngredients) {
      const name = item.name.trim();
      if (!name) continue;
      if (!slotMask[item.day]?.[item.slot]) continue;
      lines.push(
        `${item.day} ${item.slot} must feature ${name} as a main ingredient.`,
      );
    }
  }

  lines.push(`Servings: ${household.servings}.`);

  if (extraRules) {
    for (const rule of extraRules) {
      lines.push(rule);
    }
  }

  return lines.join("\n");
}
