import { handleGetSettings, handlePutSettings } from "@/ai/http";
import { requireHousehold } from "@/lib/request-auth";

export async function GET() {
  const auth = await requireHousehold();
  if (!auth.ok) {
    return Response.json(auth.result.body, { status: auth.result.status });
  }
  const result = await handleGetSettings({
    auth: { userId: auth.userId, householdId: auth.householdId },
  });
  return Response.json(result.body, { status: result.status });
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }
  const auth = await requireHousehold();
  if (!auth.ok) {
    return Response.json(auth.result.body, { status: auth.result.status });
  }
  const result = await handlePutSettings(body, {
    auth: { userId: auth.userId, householdId: auth.householdId },
  });
  return Response.json(result.body, { status: result.status });
}
