import OpenAI from "openai";
import type { AdapterRequest, AdapterResult, AiSettings } from "@/lib/types";

export function resolveApiKey(settings: AiSettings): string | undefined {
  if (settings.mode === "grok") return process.env.XAI_API_KEY || undefined;
  return settings.customApiKey ?? undefined;
}

export function createAdapter(settings: AiSettings) {
  const client = new OpenAI({
    apiKey: resolveApiKey(settings) ?? "not-needed",
    baseURL: settings.baseUrl,
  });

  return {
    async complete(req: AdapterRequest): Promise<AdapterResult> {
      try {
        const completion = await client.chat.completions.create({
          model: settings.model,
          messages: req.messages,
          response_format:
            settings.mode === "grok"
              ? {
                  type: "json_schema",
                  json_schema: {
                    name: req.schemaName,
                    schema: req.jsonSchema,
                    strict: true,
                  },
                }
              : { type: "json_object" },
        });
        const text = completion.choices[0]?.message?.content ?? "";
        return { ok: true, text };
      } catch (err) {
        const message = err instanceof Error ? err.message : "request failed";
        return { ok: false, error: message };
      }
    },
  };
}
