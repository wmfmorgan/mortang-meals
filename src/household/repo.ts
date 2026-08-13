import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { households, people } from "@/lib/schema";
import type { Household, Person } from "@/lib/types";

type HouseholdRow = typeof households.$inferSelect;
type PersonRow = typeof people.$inferSelect;

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    sex: (row.sex as Person["sex"]) ?? null,
    allergies: JSON.parse(row.allergiesJson) as string[],
    avoidances: JSON.parse(row.avoidancesJson) as string[],
  };
}

function loadPeople(householdId: string): Person[] {
  const db = getDb();
  return db
    .select()
    .from(people)
    .where(eq(people.householdId, householdId))
    .all()
    .map(mapPerson);
}

function mapHousehold(row: HouseholdRow, members: Person[]): Household {
  return {
    id: row.id,
    name: row.name,
    dietStyle: row.dietStyle,
    notes: row.notes,
    servings: row.servings,
    people: members,
  };
}

export function getHousehold(): Household | null {
  const db = getDb();
  const row = db.select().from(households).get();
  if (!row) return null;
  return mapHousehold(row, loadPeople(row.id));
}

export function upsertHousehold(
  input: Omit<Household, "id" | "people"> & { id?: string },
): Household {
  const db = getDb();
  const existing = input.id
    ? db.select().from(households).where(eq(households.id, input.id)).get()
    : db.select().from(households).get();
  const id = input.id ?? existing?.id ?? crypto.randomUUID();
  const values = {
    name: input.name,
    dietStyle: input.dietStyle,
    notes: input.notes,
    servings: input.servings,
  };

  if (existing) {
    db.update(households).set(values).where(eq(households.id, existing.id)).run();
    return mapHousehold({ ...existing, ...values }, loadPeople(existing.id));
  }

  db.insert(households).values({ id, ...values }).run();

  const row = db.select().from(households).where(eq(households.id, id)).get();
  if (!row) {
    throw new Error("Household upsert failed");
  }
  return mapHousehold(row, loadPeople(row.id));
}

export function replacePeople(
  householdId: string,
  nextPeople: Omit<Person, "id">[],
): Person[] {
  const db = getDb();
  const rows = nextPeople.map((person) => ({
    id: crypto.randomUUID(),
    householdId,
    name: person.name,
    age: person.age,
    sex: person.sex,
    allergiesJson: JSON.stringify(person.allergies),
    avoidancesJson: JSON.stringify(person.avoidances),
  }));
  db.transaction((tx) => {
    tx.delete(people).where(eq(people.householdId, householdId)).run();
    if (rows.length > 0) {
      tx.insert(people).values(rows).run();
    }
  });
  return rows.map(mapPerson);
}
