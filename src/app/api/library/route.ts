import { handleListLibrary } from "@/meals/http";
import { requireHousehold } from "@/lib/request-auth";

export async function GET(req: Request) {
  const auth = await requireHousehold();
  if (!auth.ok) {
    return Response.json(auth.result.body, { status: auth.result.status });
  }
  const slot = new URL(req.url).searchParams.get("slot");
  const result = await handleListLibrary(slot, {
    auth: { userId: auth.userId, householdId: auth.householdId },
  });
  return Response.json(result.body, { status: result.status });
}
