import { afterEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import {
  getKitchenPrefs,
  resolvedDiet,
  saveKitchenPrefs,
} from "./prefs-repo";

const users: string[] = [];
afterEach(async () => {
  await resetDbForTests();
  await Promise.all(users.splice(0).map(deleteTestUser));
});

describe("kitchen prefs", () => {
  it("defaults then persists a patch", async () => {
    const ident = await createTestIdentity();
    users.push(ident.userId);
    expect((await getKitchenPrefs(ident.householdId)).expertise).toBe(
      "intermediate",
    );
    expect((await getKitchenPrefs(ident.householdId)).maxCookMinutes).toBe(45);
    const saved = await saveKitchenPrefs(ident.householdId, {
      expertise: "newbie",
      maxCookMinutes: 25,
      dinnerDiet: "vegetarian",
    });
    expect(saved.expertise).toBe("newbie");
    expect((await getKitchenPrefs(ident.householdId)).dinnerDiet).toBe(
      "vegetarian",
    );
    expect((await getKitchenPrefs(ident.householdId)).maxCookMinutes).toBe(25);
  });

  it("resolves slot diet from override, then overall, then household", async () => {
    const ident = await createTestIdentity();
    users.push(ident.userId);
    const prefs = await saveKitchenPrefs(ident.householdId, {
      overallDiet: "Mediterranean",
      breakfastDiet: "high-protein",
      lunchDiet: "",
      dinnerDiet: "",
    });
    expect(resolvedDiet(prefs, "breakfast", "fallback")).toBe("high-protein");
    expect(resolvedDiet(prefs, "lunch", "fallback")).toBe("Mediterranean");
    expect(
      resolvedDiet({ ...prefs, overallDiet: "" }, "dinner", "fallback"),
    ).toBe("fallback");
  });

  it("saveKitchenPrefs does not change another household", async () => {
    const a = await createTestIdentity();
    const b = await createTestIdentity();
    users.push(a.userId, b.userId);
    await saveKitchenPrefs(a.householdId, { overallDiet: "keto" });
    const other = await getKitchenPrefs(b.householdId);
    expect(other.overallDiet).not.toBe("keto");
  });
});
