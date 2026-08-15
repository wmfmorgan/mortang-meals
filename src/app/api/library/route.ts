import { handleListLibrary } from "@/meals/http";

export function GET(req: Request) {
  const slot = new URL(req.url).searchParams.get("slot");
  const result = handleListLibrary(slot);
  return Response.json(result.body, { status: result.status });
}
