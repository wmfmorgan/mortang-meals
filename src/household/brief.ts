import type {
  Household,
  KitchenItem,
  Person,
  Sex,
  SlotMask,
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

export function buildHouseholdBrief(input: {
  household: Household;
  kitchen: KitchenItem[];
  slotMask: SlotMask;
  extraRules?: string[];
}): string {
  const { household, kitchen, slotMask, extraRules } = input;
  const lines: string[] = [];

  const people = household.people.map(describePerson).join(" and ");
  const peopleSentence =
    people.length > 0
      ? people.charAt(0).toUpperCase() + people.slice(1)
      : "";
  const diet = `Focusing on a ${household.dietStyle} diet.`;
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

  const slots: string[] = [];
  for (const day of DAYS) {
    for (const slot of SLOTS) {
      if (slotMask[day][slot]) {
        slots.push(`${day} ${slot}`);
      }
    }
  }
  lines.push(`Fill only these slots: ${slots.join(", ")}`);

  lines.push(`Servings: ${household.servings}.`);

  if (extraRules) {
    for (const rule of extraRules) {
      lines.push(rule);
    }
  }

  return lines.join("\n");
}
