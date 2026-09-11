import { handleGenerateExtra } from "@/ai/http";
import { handleDeleteExtra } from "@/meals/http";
import { requireHousehold } from "@/lib/request-auth";

export async function POST(req: Request) {
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
  const result = await handleGenerateExtra(body, {
    auth: { userId: auth.userId, householdId: auth.householdId },
  });
  return Response.json(result.body, { status: result.status });
}

export async function DELETE(req: Request) {
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
  const result = await handleDeleteExtra(body, {
    auth: { userId: auth.userId, householdId: auth.householdId },
  });
  return Response.json(result.body, { status: result.status });
}
