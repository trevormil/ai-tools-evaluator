import { test, expect } from "bun:test";
import { handleSubmit, buildQueueEntry, utf8ToBase64, type Env, type Deps } from "./index";

const env: Env = {
  GITHUB_TOKEN: "tok",
  GITHUB_REPO: "acme/aix",
  GITHUB_BRANCH: "main",
  ALLOWED_ORIGIN: "https://aix.example",
};

/** A fake GitHub Contents API that records the PUT and returns `ok`. */
function fakeGitHub(ok = true) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(ok ? "{}" : "boom", { status: ok ? 201 : 500 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

function deps(fetchImpl: typeof fetch): Deps {
  return {
    fetch: fetchImpl,
    now: () => Date.parse("2026-07-12T00:00:00Z"),
    randomId: () => "abcd1234",
  };
}

function post(body: unknown): Request {
  return new Request("https://w/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("utf8ToBase64 round-trips (incl. non-ASCII)", () => {
  expect(atob(utf8ToBase64("café ☕"))).toBe(
    Array.from(new TextEncoder().encode("café ☕"))
      .map((b) => String.fromCharCode(b))
      .join(""),
  );
});

test("buildQueueEntry produces a safe path + web submission body", () => {
  const { path, body } = buildQueueEntry(
    "BurntSushi/ripgrep",
    "nice",
    "2026-07-12T00:00:00Z",
    "abcd1234",
  );
  expect(path).toBe("content/queue/burntsushi-ripgrep-abcd1234.json");
  expect(body).toEqual({
    url: "https://github.com/BurntSushi/ripgrep",
    note: "nice",
    source: "web",
    submittedAt: "2026-07-12T00:00:00Z",
  });
});

test("a valid GitHub repo URL is written to the queue via the Contents API", async () => {
  const gh = fakeGitHub(true);
  const res = await handleSubmit(
    post({ url: "https://github.com/BurntSushi/ripgrep" }),
    env,
    deps(gh.fetchImpl),
  );
  expect(res.status).toBe(201);
  expect(res.headers.get("access-control-allow-origin")).toBe("https://aix.example");
  expect(gh.calls).toHaveLength(1);
  const call = gh.calls[0]!;
  expect(call.url).toBe(
    "https://api.github.com/repos/acme/aix/contents/content/queue/burntsushi-ripgrep-abcd1234.json",
  );
  expect(call.init.method).toBe("PUT");
  const sent = JSON.parse(call.init.body as string) as { content: string; branch: string };
  expect(sent.branch).toBe("main");
  const decoded = JSON.parse(
    new TextDecoder().decode(Uint8Array.from(atob(sent.content), (c) => c.charCodeAt(0))),
  ) as { url: string; source: string };
  expect(decoded.url).toBe("https://github.com/BurntSushi/ripgrep");
  expect(decoded.source).toBe("web");
});

test("a non-GitHub URL is rejected 422 and never touches GitHub", async () => {
  const gh = fakeGitHub(true);
  const res = await handleSubmit(post({ url: "https://gitlab.com/x/y" }), env, deps(gh.fetchImpl));
  expect(res.status).toBe(422);
  expect(gh.calls).toHaveLength(0);
});

test("a missing url is a 400", async () => {
  const gh = fakeGitHub(true);
  const res = await handleSubmit(post({ note: "no url" }), env, deps(gh.fetchImpl));
  expect(res.status).toBe(400);
  expect(gh.calls).toHaveLength(0);
});

test("a GitHub API failure surfaces as 502", async () => {
  const gh = fakeGitHub(false);
  const res = await handleSubmit(post({ url: "https://github.com/a/b" }), env, deps(gh.fetchImpl));
  expect(res.status).toBe(502);
});

test("OPTIONS preflight returns 204 with CORS", async () => {
  const gh = fakeGitHub(true);
  const res = await handleSubmit(
    new Request("https://w/submit", { method: "OPTIONS" }),
    env,
    deps(gh.fetchImpl),
  );
  expect(res.status).toBe(204);
  expect(res.headers.get("access-control-allow-methods")).toContain("POST");
});
