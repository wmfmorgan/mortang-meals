import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { householdMembers, households, people } from "@/lib/schema";
import type { Household, Person } from "@/lib/types";

type HouseholdRow = typeof households.$inferSelect;
type PersonRow = typeof people.$inferSelect;

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    sex: (row.sex as Person["sex"]) ?? null,
    allergies: row.allergies,
    avoidances: row.avoidances,
  };
}

async function loadPeople(householdId: string): Promise<Person[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(people)
    .where(eq(people.householdId, householdId));
  return rows.map(mapPerson);
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

export async function getHouseholdForUser(
  userId: string,
): Promise<Household | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: households.id,
      ownerId: households.ownerId,
      name: households.name,
      dietStyle: households.dietStyle,
      notes: households.notes,
      servings: households.servings,
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId))
    .limit(1);
  if (!row) return null;
  return mapHousehold(row, await loadPeople(row.id));
}

export async function upsertHousehold(
  input: Omit<Household, "id" | "people"> & { id?: string; ownerId: string },
): Promise<Household> {
  const db = getDb();
  const id = input.id ?? crypto.randomUUID();
  const values = {
    name: input.name,
    dietStyle: input.dietStyle,
    notes: input.notes,
    servings: input.servings,
  };

  const [row] = await db
    .insert(households)
    .values({ id, ownerId: input.ownerId, ...values })
    .onConflictDoUpdate({
      target: households.ownerId,
      set: values,
    })
    .returning();

  if (!row) {
    throw new Error("Household upsert failed");
  }

  await db
    .insert(householdMembers)
    .values({
      householdId: row.id,
      userId: input.ownerId,
      role: "owner",
    })
    .onConflictDoNothing({ target: householdMembers.userId });

  return mapHousehold(row, await loadPeople(row.id));
}

export async function replacePeople(
  householdId: string,
  nextPeople: Omit<Person, "id">[],
): Promise<Person[]> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.delete(people).where(eq(people.householdId, householdId));
    if (nextPeople.length === 0) return [];
    const inserted = await tx
      .insert(people)
      .values(
        nextPeople.map((person) => ({
          householdId,
          name: person.name,
          age: person.age,
          sex: person.sex,
          allergies: person.allergies,
          avoidances: person.avoidances,
        })),
      )
      .returning();
    return inserted.map(mapPerson);
  });
}
