import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { meals } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { listLibraryMeals, saveStandaloneMeal } from "@/meals/repo";

const users: string[] = [];

afterEach(async () => {
  await resetDbForTests();
  await Promise.all(users.splice(0).map(deleteTestUser));
});

function dinnerInput(title: string) {
  return {
    meal: {
      day: "monday" as const,
      slot: "dinner" as const,
      title,
      whyItFits: "x",
      cookMinutes: 20,
      method: "pot",
      ingredients: [
        { name: "beans", quantity: "1", unit: "can", aisle: "pantry" as const },
      ],
      steps: ["Cook"],
    },
    slot: "dinner" as const,
  };
}

describe("rls", () => {
  it("Data API cannot read meals as authenticated", async () => {
    const ident = await createTestIdentity();
    users.push(ident.userId);
    await saveStandaloneMeal(ident.householdId, dinnerInput("Secret stew"));
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const client = createClient(url, anon);
    const { data, error } = await client.from("meals").select("*");
    expect(data ?? []).toEqual([]);
    expect(error).toBeTruthy();
  });

  it("server-role drizzle reads both households; listLibraryMeals stays scoped", async () => {
    const a = await createTestIdentity();
    const b = await createTestIdentity();
    users.push(a.userId, b.userId);
    await saveStandaloneMeal(a.householdId, dinnerInput("A dinner"));
    await saveStandaloneMeal(b.householdId, dinnerInput("B dinner"));
    const all = await getDb().select().from(meals);
    expect(all).toHaveLength(2);
    const listed = await listLibraryMeals(a.householdId, "dinner");
    expect(listed.map((meal) => meal.title)).toEqual(["A dinner"]);
  });
});
