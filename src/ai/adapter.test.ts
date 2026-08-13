import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdapter, resolveApiKey } from "./adapter";
import OpenAI from "openai";
import type { AdapterRequest, AiSettings } from "@/lib/types";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: createMock } },
  })),
}));

const grokSettings: AiSettings = {
  mode: "grok",
  baseUrl: "https://api.x.ai/v1",
  model: "grok-4.6",
  customApiKey: "ignored",
  developerTools: false,
};

const customSettings: AiSettings = {
  mode: "custom",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "llama",
  customApiKey: null,
  developerTools: false,
};

const request: AdapterRequest = {
  messages: [
    { role: "system", content: "Return JSON" },
    { role: "user", content: "Plan dinner" },
  ],
  jsonSchema: { type: "object", properties: { title: { type: "string" } } },
  schemaName: "meal",
};

afterEach(() => {
  createMock.mockReset();
  vi.mocked(OpenAI).mockClear();
  delete process.env.XAI_API_KEY;
});

it("resolveApiKey uses XAI_API_KEY for grok and the stored key for custom", () => {
  process.env.XAI_API_KEY = "xai-secret";
  expect(
    resolveApiKey({
      mode: "grok",
      baseUrl: "https://api.x.ai/v1",
      model: "grok-4.6",
      customApiKey: "ignored",
      developerTools: false,
    }),
  ).toBe("xai-secret");
  expect(
    resolveApiKey({
      mode: "custom",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "llama",
      customApiKey: null,
      developerTools: false,
    }),
  ).toBeUndefined();
  expect(
    resolveApiKey({
      mode: "custom",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "llama",
      customApiKey: "local-secret",
      developerTools: false,
    }),
  ).toBe("local-secret");
});

describe("createAdapter", () => {
  it("calls the SDK with json_schema for grok and json_object for custom", async () => {
    process.env.XAI_API_KEY = "xai-secret";
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"title":"Soup"}' } }],
    });

    const grok = createAdapter(grokSettings);
    const grokResult = await grok.complete(request);

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: "xai-secret",
      baseURL: "https://api.x.ai/v1",
    });
    expect(createMock).toHaveBeenCalledWith({
      model: "grok-4.6",
      messages: request.messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "meal",
          schema: request.jsonSchema,
          strict: true,
        },
      },
    });
    expect(grokResult).toEqual({ ok: true, text: '{"title":"Soup"}' });

    createMock.mockClear();
    vi.mocked(OpenAI).mockClear();

    const custom = createAdapter(customSettings);
    await custom.complete(request);

    expect(OpenAI).toHaveBeenCalledWith({
      apiKey: "not-needed",
      baseURL: "http://127.0.0.1:11434/v1",
    });
    expect(createMock).toHaveBeenCalledWith({
      model: "llama",
      messages: request.messages,
      response_format: { type: "json_object" },
    });
  });

  it("returns an error result when the SDK throws", async () => {
    createMock.mockRejectedValue(new Error("upstream down"));
    const adapter = createAdapter(customSettings);
    await expect(adapter.complete(request)).resolves.toEqual({
      ok: false,
      error: "upstream down",
    });
  });
});
