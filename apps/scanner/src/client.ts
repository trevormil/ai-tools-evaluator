import { z } from "zod";
import type { Evaluation } from "@aix/core";

/**
 * Thin typed HTTP client for the web app's internal API (`docs/internal-api.md`).
 * The scanner never opens SQLite; it POSTs validated Evaluations here. All calls
 * carry `Authorization: Bearer $AIX_INTERNAL_TOKEN`. Responses are validated with
 * zod so a drifting server surfaces loudly instead of corrupting a run.
 */

const CapSchema = z.object({
  date: z.string(),
  publishedToday: z.number(),
  remaining: z.number(),
  dailyCap: z.number(),
  // Independent submission budget (optional: absent on an older server).
  submissions: z
    .object({
      publishedToday: z.number(),
      remaining: z.number(),
      cap: z.number(),
    })
    .optional(),
});
export type CapInfo = z.infer<typeof CapSchema>;

const SubmissionSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    url: z.string().url(),
    note: z.string().optional(),
    status: z.string(),
    source: z.string().optional(),
  })
  .passthrough();
export type Submission = z.infer<typeof SubmissionSchema>;

const SubmissionsSchema = z.object({ submissions: z.array(SubmissionSchema) });

const PublishSchema = z.object({
  duplicate: z.boolean().optional().default(false),
  item: z.record(z.unknown()).optional(),
});
export type PublishResult = z.infer<typeof PublishSchema>;

const ScanRunSchema = z.object({ id: z.union([z.string(), z.number()]) });

const KnownSchema = z.object({ known: z.array(z.string()) });

/** A discovery candidate reduced to its identity, for pre-eval dedup. */
export type CandidateId = { kind: string; externalId: string };

export type SubmissionStatus = "processing" | "published" | "duplicate" | "rejected" | "failed";

export type ScanRunClose = {
  status: "success" | "error";
  discovered: number;
  published: number;
  skippedDuplicate: number;
  error?: string;
};

export type InternalClient = {
  getCap(): Promise<CapInfo>;
  /** Pre-eval dedup: returns the subset of candidate externalIds already graded. */
  filterKnown(candidates: CandidateId[]): Promise<Set<string>>;
  listQueuedSubmissions(limit: number): Promise<Submission[]>;
  publishItem(
    evaluation: Evaluation,
    submissionId?: string,
    readmeMd?: string,
  ): Promise<PublishResult>;
  patchSubmission(
    id: string | number,
    body: { status: SubmissionStatus; reason?: string; itemId?: string },
  ): Promise<void>;
  openScanRun(source: string): Promise<string | number>;
  closeScanRun(id: string | number, body: ScanRunClose): Promise<void>;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function createInternalClient(opts: {
  baseUrl: string;
  token: string;
  fetchImpl?: FetchLike;
}): InternalClient {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((i, init) => fetch(i, init));

  async function req(path: string, init?: RequestInit): Promise<unknown> {
    const res = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`${init?.method ?? "GET"} ${path} -> ${res.status} ${detail.slice(0, 300)}`);
    }
    if (res.status === 204) return undefined;
    return res.json();
  }

  return {
    async getCap() {
      return CapSchema.parse(await req("/api/internal/cap"));
    },

    async filterKnown(candidates) {
      if (candidates.length === 0) return new Set<string>();
      const data = await req("/api/internal/items/known", {
        method: "POST",
        body: JSON.stringify({ candidates }),
      });
      return new Set(KnownSchema.parse(data).known);
    },

    async listQueuedSubmissions(limit) {
      const data = await req(`/api/internal/submissions?status=queued&limit=${limit}`);
      return SubmissionsSchema.parse(data).submissions;
    },

    async publishItem(evaluation, submissionId, readmeMd) {
      const data = await req("/api/internal/items", {
        method: "POST",
        // README travels alongside the evaluation so the item page can show
        // what the repo says about itself (cap matches the server's).
        body: JSON.stringify({ evaluation, submissionId, readmeMd: readmeMd?.slice(0, 200_000) }),
      });
      return PublishSchema.parse(data);
    },

    async patchSubmission(id, body) {
      await req(`/api/internal/submissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },

    async openScanRun(source) {
      const data = await req("/api/internal/scan-runs", {
        method: "POST",
        body: JSON.stringify({ source }),
      });
      return ScanRunSchema.parse(data).id;
    },

    async closeScanRun(id, body) {
      await req(`/api/internal/scan-runs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
  };
}
