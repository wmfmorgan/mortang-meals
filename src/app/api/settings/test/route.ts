import { handleTestConnection } from "@/ai/http";

export async function POST() {
  const result = await handleTestConnection();
  return Response.json(result.body, { status: result.status });
}
