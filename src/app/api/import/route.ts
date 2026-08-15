import { handleImportRecipe } from "@/meals/http";

export type ImportStreamEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "done"; mealId: string }
  | { type: "error"; status: number; message: string };

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
      const send = (event: ImportStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const result = await handleImportRecipe(body, {
        signal: req.signal,
        onProgress: (event) => {
          if (req.signal.aborted) return;
          send({ type: "progress", ...event });
        },
      });

      if (result.status === 200) {
        const meal = (result.body as { meal?: { id: string } }).meal;
        send({ type: "done", mealId: meal?.id ?? "" });
      } else {
        const message =
          (result.body as { message?: string }).message ??
          "Couldn’t import that recipe.";
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
