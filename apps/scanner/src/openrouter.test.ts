import { describe, expect, test } from "bun:test";
import { createOpenRouterModel } from "./evaluate";

describe("createOpenRouterModel", () => {
  test("posts an OpenAI-style chat completion and returns trimmed content", async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '  {"ok":true}  ' } }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const model = createOpenRouterModel({
      apiKey: "sk-or-test",
      model: "google/gemini-3.1-flash-lite",
      fetchImpl,
    });
    const out = await model.complete("SYSTEM", "USER");

    expect(out).toBe('{"ok":true}');
    expect(captured!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(captured!.init.body as string);
    expect(body.model).toBe("google/gemini-3.1-flash-lite");
    expect(body.messages).toEqual([
      { role: "system", content: "SYSTEM" },
      { role: "user", content: "USER" },
    ]);
    const headers = captured!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-or-test");
  });

  test("default completion budget fits an evaluation WITH a deepDive (0087)", async () => {
    // 4096 truncated deep-dive drafts mid-JSON in prod (poirot: 'Expected ]'
    // after 3 attempts; qwen: repair shrank the draft by dropping deepDive).
    let body: { max_tokens?: number } | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;
    await createOpenRouterModel({ apiKey: "k", model: "m", fetchImpl }).complete("s", "u");
    expect(body!.max_tokens).toBeGreaterThanOrEqual(8192);
  });

  test("throws with status + body on a non-2xx response", async () => {
    const fetchImpl = (async () =>
      new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    const model = createOpenRouterModel({ apiKey: "k", model: "m", fetchImpl });
    await expect(model.complete("s", "u")).rejects.toThrow(/429.*rate limited/);
  });
});
