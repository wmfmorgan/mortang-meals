import { handleClearTraces, handleListTraces } from "@/ai/http";

export async function GET() {
  const result = handleListTraces();
  return Response.json(result.body, { status: result.status });
}

export async function DELETE() {
  const result = handleClearTraces();
  return Response.json(result.body, { status: result.status });
}
