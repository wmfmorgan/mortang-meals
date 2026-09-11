import { handleClearTraces, handleListTraces } from "@/ai/http";
import { requireHousehold } from "@/lib/request-auth";

export async function GET() {
  const auth = await requireHousehold();
  if (!auth.ok) {
    return Response.json(auth.result.body, { status: auth.result.status });
  }
  const result = await handleListTraces({
    auth: { userId: auth.userId, householdId: auth.householdId },
  });
  return Response.json(result.body, { status: result.status });
}

export async function DELETE() {
  const auth = await requireHousehold();
  if (!auth.ok) {
    return Response.json(auth.result.body, { status: auth.result.status });
  }
  const result = await handleClearTraces({
    auth: { userId: auth.userId, householdId: auth.householdId },
  });
  return Response.json(result.body, { status: result.status });
}
