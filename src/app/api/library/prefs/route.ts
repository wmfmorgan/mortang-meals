import { getLibraryGeneratePrefs, saveLibraryGeneratePrefs } from "@/meals/library-prefs";

export function GET() {
  return Response.json({ prefs: getLibraryGeneratePrefs() });
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }
  saveLibraryGeneratePrefs(body);
  return Response.json({ ok: true });
}
