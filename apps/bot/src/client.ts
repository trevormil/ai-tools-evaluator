import { z } from "zod";

/**
 * Typed HTTP client for the `web` internal API. The bot never touches the DB —
 * it only ever calls POST /api/internal/submissions and GET /api/internal/digest
 * with `Authorization: Bearer <token>`. See docs/internal-api.md.
 */

/** Shape of a published item as returned by the digest endpoint. */
export const DigestItem = z.object({
  slug: z.string(),
  title: z.string(),
  url: z.string(),
  verdict: z.string(),
  overallScore: z.number(),
  noiseScore: z.number().nullish(),
  tagline: z.string(),
  category: z.string(),
  primaryAudience: z.string().nullish(),
  aiEngineerFit: z.number().nullish(),
  coverImageUrl: z.string().nullish(),
  // Decision layer (optional — older items predate it).
  install: z.string().nullish(),
  adoptIf: z.array(z.string()).optional(),
  skipIf: z.array(z.string()).optional(),
  /** Plainspoken "what it is" — posted as the message text above the embed. */
  summary: z.string().nullish(),
});
export type DigestItem = z.infer<typeof DigestItem>;

const DigestResponse = z.object({ items: z.array(DigestItem) });

export type SubmitInput = {
  url: string;
  note?: string;
  discordUserId?: string;
};

export type SubmitResult = {
  /** True when the API reported the link was already queued/known. */
  duplicate: boolean;
  submission?: unknown;
};

export type FetchLike = typeof fetch;

export type InternalClientOptions = {
  baseUrl: string;
  token: string;
  /** Injectable for tests; defaults to global fetch. */
  fetch?: FetchLike;
};

export type InternalClient = {
  enqueueSubmission(input: SubmitInput): Promise<SubmitResult>;
  fetchDigest(since: Date | string): Promise<DigestItem[]>;
};

export function createInternalClient(opts: InternalClientOptions): InternalClient {
  const doFetch = opts.fetch ?? fetch;
  const base = opts.baseUrl.replace(/\/+$/, "");
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${opts.token}`,
  } as const;

  return {
    async enqueueSubmission(input) {
      const res = await doFetch(`${base}/api/internal/submissions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: input.url,
          note: input.note,
          source: "discord",
          discordUserId: input.discordUserId,
        }),
      });
      if (!res.ok) {
        throw new Error(`POST /api/internal/submissions failed: ${res.status}`);
      }
      const json = (await res.json()) as { duplicate?: boolean; submission?: unknown };
      return { duplicate: json?.duplicate === true, submission: json?.submission };
    },

    async fetchDigest(since) {
      const iso = typeof since === "string" ? since : since.toISOString();
      const res = await doFetch(`${base}/api/internal/digest?since=${encodeURIComponent(iso)}`, {
        method: "GET",
        headers,
      });
      if (!res.ok) {
        throw new Error(`GET /api/internal/digest failed: ${res.status}`);
      }
      return DigestResponse.parse(await res.json()).items;
    },
  };
}
