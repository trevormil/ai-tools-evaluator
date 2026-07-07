import { describe, expect, test } from "bun:test";
import { createInternalClient } from "./client";

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

describe("listQueuedSubmissions", () => {
  test("parses submissions with null note/source (e.g. /score drops) without throwing", async () => {
    const client = createInternalClient({
      baseUrl: "https://aix.test",
      token: "t",
      fetchImpl: fakeFetch({
        submissions: [
          { id: "s1", url: "https://github.com/a/b", note: null, status: "queued", source: null },
          { id: "s2", url: "https://github.com/c/d", note: "has a note", status: "queued" },
        ],
      }),
    });
    const subs = await client.listQueuedSubmissions(10);
    expect(subs).toHaveLength(2);
    expect(subs[0]!.url).toBe("https://github.com/a/b");
  });
});
