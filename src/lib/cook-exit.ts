export type CookFrom = "plans" | "meals";

function one(value?: string | string[] | null): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

export function cookMealHref(
  mealId: string,
  from: CookFrom,
  planId?: string | null,
): string {
  const params = new URLSearchParams({ from });
  if (from === "plans" && planId) params.set("plan", planId);
  return `/meals/${mealId}?${params.toString()}`;
}

export function cookExit(
  from?: string | string[] | null,
  planId?: string | string[] | null,
): { href: string; label: string } {
  if (one(from) === "plans") {
    const plan = one(planId);
    return {
      href: plan ? `/?plan=${encodeURIComponent(plan)}` : "/",
      label: "Exit to Plans",
    };
  }
  return { href: "/meals", label: "Exit to Library" };
}
