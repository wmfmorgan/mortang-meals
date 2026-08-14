import OpenAI from "openai";
import type { AdapterRequest, AdapterResult, AiSettings } from "@/lib/types";

export function resolveApiKey(settings: AiSettings): string | undefined {
  if (settings.mode === "grok") return process.env.XAI_API_KEY || undefined;
  return settings.customApiKey ?? undefined;
}

export function grokWebSearchEnabled(
  settings: Pick<AiSettings, "mode" | "webSearch">,
): boolean {
  return settings.mode === "grok" && settings.webSearch;
}

function extractResponseText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const record = response as {
    output_text?: unknown;
    output?: unknown;
  };
  if (typeof record.output_text === "string" && record.output_text.length > 0) {
    return record.output_text;
  }
  if (!Array.isArray(record.output)) return "";
  const parts: string[] = [];
  for (const item of record.output) {
    if (!item || typeof item !== "object") continue;
    const entry = item as { type?: unknown; content?: unknown };
    if (entry.type !== "message" || !Array.isArray(entry.content)) continue;
    for (const block of entry.content) {
      if (!block || typeof block !== "object") continue;
      const content = block as { type?: unknown; text?: unknown };
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("");
}

export function createAdapter(settings: AiSettings) {
  const client = new OpenAI({
    apiKey: resolveApiKey(settings) ?? "not-needed",
    baseURL: settings.baseUrl,
  });

  return {
    async complete(req: AdapterRequest): Promise<AdapterResult> {
      try {
        if (grokWebSearchEnabled(settings)) {
          const body = {
            model: settings.model,
            input: req.messages,
            tools: [{ type: "web_search" as const }],
            text: {
              format: {
                type: "json_schema" as const,
                name: req.schemaName,
                schema: req.jsonSchema,
                strict: true,
              },
            },
          };
          const response = req.signal
            ? await client.responses.create(body, { signal: req.signal })
            : await client.responses.create(body);
          return { ok: true, text: extractResponseText(response) };
        }

        const body = {
          model: settings.model,
          messages: req.messages,
          response_format:
            settings.mode === "grok"
              ? {
                  type: "json_schema" as const,
                  json_schema: {
                    name: req.schemaName,
                    schema: req.jsonSchema,
                    strict: true,
                  },
                }
              : { type: "json_object" as const },
        };
        const completion = req.signal
          ? await client.chat.completions.create(body, { signal: req.signal })
          : await client.chat.completions.create(body);
        const text = completion.choices[0]?.message?.content ?? "";
        return { ok: true, text };
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return { ok: false, error: "cancelled" };
        }
        const message = err instanceof Error ? err.message : "request failed";
        return { ok: false, error: message };
      }
    },
  };
}
