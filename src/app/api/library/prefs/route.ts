import { getLibraryGeneratePrefs, saveLibraryGeneratePrefs } from "@/meals/library-prefs";
import { requireHousehold } from "@/lib/request-auth";

export async function GET() {
  const auth = await requireHousehold();
  if (!auth.ok) {
    return Response.json(auth.result.body, { status: auth.result.status });
  }
  return Response.json({
    prefs: await getLibraryGeneratePrefs(auth.householdId),
  });
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
  await saveLibraryGeneratePrefs(auth.householdId, body);
  return Response.json({ ok: true });
}
