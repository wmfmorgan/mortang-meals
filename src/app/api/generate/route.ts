import { handleGenerate, type GenerateStreamEvent, type GenerateUiEvent } from "@/ai/http";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ message: "Invalid JSON." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerateStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const result = await handleGenerate(body, {
        onProgress: (event: GenerateUiEvent) => {
          send({ type: "progress", ...event });
        },
      });

      if (result.status === 200) {
        const plan = (result.body as { plan?: { id: string } }).plan;
        send({ type: "done", planId: plan?.id ?? "" });
      } else {
        const message =
          (result.body as { message?: string }).message ??
          "Couldn’t get a usable plan, try again.";
        send({ type: "error", status: result.status, message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
