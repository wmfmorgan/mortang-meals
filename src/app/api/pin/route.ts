import { handlePin } from "@/meals/http";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }
  const result = handlePin(body);
  return Response.json(result.body, { status: result.status });
}
