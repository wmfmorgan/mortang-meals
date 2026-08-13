import type { Sex } from "@/lib/types";

export type PersonFormRow = {
  name: string;
  age: string;
  sex: "" | Sex;
  allergies: string;
  avoidances: string;
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function normalizePeople(rows: PersonFormRow[]) {
  return rows
    .map((person) => ({
      name: person.name.trim(),
      age: Number.parseInt(person.age, 10) || 0,
      sex: person.sex === "" ? null : person.sex,
      allergies: splitCsv(person.allergies),
      avoidances: splitCsv(person.avoidances),
    }))
    .filter((person) => person.name.length > 0);
}
