import { handleGetSettings, handlePutSettings } from "@/ai/http";

export async function GET() {
  const result = handleGetSettings();
  return Response.json(result.body, { status: result.status });
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }
  const result = handlePutSettings(body);
  return Response.json(result.body, { status: result.status });
}
