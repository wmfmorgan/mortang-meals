import {
  handleGenerateLibrary,
  type GenerateStreamEvent,
  type GenerateUiEvent,
} from "@/ai/http";

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

      const result = await handleGenerateLibrary(body, {
        signal: req.signal,
        onProgress: (event: GenerateUiEvent) => {
          if (req.signal.aborted) return;
          send({ type: "progress", ...event });
        },
      });

      if (result.status === 200) {
        send({ type: "done", planId: "library" });
      } else {
        const message =
          (result.body as { message?: string }).message ??
          "Couldn’t get usable recipes, try again.";
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
