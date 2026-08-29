import { handleGenerateExtra } from "@/ai/http";
import { handleDeleteExtra } from "@/meals/http";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }
  const result = await handleGenerateExtra(body);
  return Response.json(result.body, { status: result.status });
}

export async function DELETE(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }
  const result = handleDeleteExtra(body);
  return Response.json(result.body, { status: result.status });
}
