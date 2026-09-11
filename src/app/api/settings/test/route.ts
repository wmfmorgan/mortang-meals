import { handleTestConnection } from "@/ai/http";
import { requireHousehold } from "@/lib/request-auth";

export async function POST() {
  const auth = await requireHousehold();
  if (!auth.ok) {
    return Response.json(auth.result.body, { status: auth.result.status });
  }
  const result = await handleTestConnection({
    auth: { userId: auth.userId, householdId: auth.householdId },
  });
  return Response.json(result.body, { status: result.status });
}
