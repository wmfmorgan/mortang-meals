import { afterEach, describe, expect, it, vi } from "vitest";
import { createAdapter, resolveApiKey } from "./adapter";
import OpenAI from "openai";
import type { AdapterRequest, AiSettings } from "@/lib/types";

const { createMock, responsesCreateMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  responsesCreateMock: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: createMock } },
    responses: { create: responsesCreateMock },
  })),
}));

const grokSettings: AiSettings = {
  mode: "grok",
  baseUrl: "https://api.x.ai/v1",
  model: "grok-4.6",
  customApiKey: "ignored",
  developerTools: false,
  webSearch: false,
};

const customSettings: AiSettings = {
  mode: "custom",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "llama",
  customApiKey: null,
  developerTools: false,
  webSearch: false,
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
  responsesCreateMock.mockReset();
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
      webSearch: false,
    }),
  ).toBe("xai-secret");
  expect(
    resolveApiKey({
      mode: "custom",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "llama",
      customApiKey: null,
      developerTools: false,
      webSearch: false,
    }),
  ).toBeUndefined();
  expect(
    resolveApiKey({
      mode: "custom",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "llama",
      customApiKey: "local-secret",
      developerTools: false,
      webSearch: false,
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
    expect(responsesCreateMock).not.toHaveBeenCalled();
  });

  it("uses the Responses API with web_search when Grok web search is on", async () => {
    process.env.XAI_API_KEY = "xai-secret";
    responsesCreateMock.mockResolvedValue({
      output_text: '{"title":"Searched soup"}',
    });

    const adapter = createAdapter({ ...grokSettings, webSearch: true });
    const result = await adapter.complete(request);

    expect(createMock).not.toHaveBeenCalled();
    expect(responsesCreateMock).toHaveBeenCalledWith({
      model: "grok-4.6",
      input: request.messages,
      tools: [{ type: "web_search" }],
      text: {
        format: {
          type: "json_schema",
          name: "meal",
          schema: request.jsonSchema,
          strict: true,
        },
      },
    });
    expect(result).toEqual({ ok: true, text: '{"title":"Searched soup"}' });
  });

  it("does not enable web_search for custom mode even if the toggle is on", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: '{"title":"Local soup"}' } }],
    });

    const adapter = createAdapter({ ...customSettings, webSearch: true });
    await adapter.complete(request);

    expect(responsesCreateMock).not.toHaveBeenCalled();
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
