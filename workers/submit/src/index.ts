import { validateGithubRepoUrl } from "@aix/core";

/**
 * AIx submission Worker (ADR-0004). The one piece of server-side code in the
 * static architecture: it takes a "submit a URL" POST from the site and writes a
 * queue file to `content/queue/<id>.json` via the GitHub Contents API. The daily
 * scanner drains the queue on its next run. Free tier, no database.
 */
export type Env = {
  /** GitHub token with `contents:write` on the target repo (Worker secret). */
  GITHUB_TOKEN: string;
  /** "owner/repo" the queue lives in. */
  GITHUB_REPO: string;
  /** Branch to commit to (default "main"). */
  GITHUB_BRANCH?: string;
  /** Allowed CORS origin for the browser POST (default "*"). */
  ALLOWED_ORIGIN?: string;
};

export type Deps = {
  fetch: typeof fetch;
  now: () => number;
  randomId: () => string;
};

const jsonHeaders = (origin: string) => ({
  "content-type": "application/json",
  "access-control-allow-origin": origin,
});

function corsPreflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    },
  });
}

/** UTF-8-safe base64 (the GitHub Contents API wants base64 file content). */
export function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** The queue file path + JSON body for a validated submission. */
export function buildQueueEntry(
  externalId: string,
  note: string | undefined,
  submittedAt: string,
  id: string,
): { path: string; body: { url: string; note?: string; source: "web"; submittedAt: string } } {
  const safe = externalId.replace(/[^\w.-]+/g, "-").toLowerCase();
  return {
    path: `content/queue/${safe}-${id}.json`,
    body: {
      url: `https://github.com/${externalId}`,
      ...(note ? { note } : {}),
      source: "web",
      submittedAt,
    },
  };
}

export async function handleSubmit(req: Request, env: Env, deps: Deps): Promise<Response> {
  const origin = env.ALLOWED_ORIGIN ?? "*";

  if (req.method === "OPTIONS") return corsPreflight(origin);
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders(origin),
    });
  }

  let payload: { url?: unknown; note?: unknown };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: jsonHeaders(origin),
    });
  }

  if (typeof payload.url !== "string") {
    return new Response(JSON.stringify({ error: "A `url` string is required." }), {
      status: 400,
      headers: jsonHeaders(origin),
    });
  }
  const note = typeof payload.note === "string" ? payload.note.slice(0, 1000) : undefined;

  const check = validateGithubRepoUrl(payload.url);
  if (!check.ok) {
    return new Response(JSON.stringify({ error: check.reason }), {
      status: 422,
      headers: jsonHeaders(origin),
    });
  }

  const submittedAt = new Date(deps.now()).toISOString();
  const { path, body } = buildQueueEntry(check.externalId, note, submittedAt, deps.randomId());

  const branch = env.GITHUB_BRANCH ?? "main";
  const apiUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`;
  const ghRes = await deps.fetch(apiUrl, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "user-agent": "aix-submit-worker",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: `chore(queue): submit ${check.externalId}`,
      content: utf8ToBase64(JSON.stringify(body, null, 2)),
      branch,
    }),
  });

  if (!ghRes.ok) {
    return new Response(JSON.stringify({ error: "Could not queue the submission." }), {
      status: 502,
      headers: jsonHeaders(origin),
    });
  }

  return new Response(JSON.stringify({ ok: true, queued: check.externalId }), {
    status: 201,
    headers: jsonHeaders(origin),
  });
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handleSubmit(req, env, {
      fetch,
      now: () => Date.now(),
      randomId: () => crypto.randomUUID().slice(0, 8),
    });
  },
};
