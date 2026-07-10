import { ItemSource } from "@aix/core";
import type { Discovered, DiscoverySource } from "../types";
import { nullLogger, type Logger } from "../logger";

/**
 * skills.sh discovery — Claude/agent skills, judged through the agent-tool lens
 * (a skill IS an agent tool, so "is this better than a base agent doing it?" is
 * the right frame). skills.sh requires a Vercel OIDC token we can't mint on
 * DOKS, so the scanner talks to a thin Vercel proxy instead (see
 * docs/skills-proxy). When the proxy env is absent the source is never built.
 *
 * The trending listing has no description, so we fetch each skill's files (its
 * SKILL.md etc.) as the evaluator's "readme". `installs` is the popularity
 * signal — stored in `upvotes` so it ranks like ProductHunt/HN counts.
 */

/** Fields from the trending leaderboard listing (docs/api). */
type SkillListing = {
  id?: string; // "<owner>/<repo>/<slug>"
  slug?: string;
  name?: string;
  source?: string; // "<owner>/<repo>"
  installs?: number;
  installUrl?: string; // the GitHub repo
  url?: string; // the skills.sh page
};

/** Tolerant of the list wrapper shape (array, or {skills|data|results|items}). */
export function extractListings(json: unknown): SkillListing[] {
  if (Array.isArray(json)) return json as SkillListing[];
  const o = (json ?? {}) as Record<string, unknown>;
  for (const k of ["skills", "data", "results", "items"]) {
    if (Array.isArray(o[k])) return o[k] as SkillListing[];
  }
  return [];
}

/** The evaluator's readme, assembled from a skill's files (SKILL.md, …). */
export function detailReadme(json: unknown): string {
  const files = (json as { files?: { path?: string; contents?: string }[] })?.files;
  if (!Array.isArray(files)) return "";
  return files
    .filter((f) => typeof f?.contents === "string")
    .map((f) => `### ${f.path ?? "file"}\n${f.contents}`)
    .join("\n\n")
    .slice(0, 12000);
}

/** Map a listing (+ optional file content) to a Discovered skill, or null. */
export function toDiscovered(s: SkillListing, readme: string): Discovered | null {
  if (!s.id || !(s.name || s.slug)) return null;
  const url = s.url || s.installUrl;
  if (!url) return null;
  try {
    const source = ItemSource.parse({
      kind: "skill",
      externalId: s.id.slice(0, 200),
      url,
      title: (s.name || s.slug || s.id).slice(0, 200),
      description: `A Claude/agent skill from ${s.source ?? "the registry"}.`,
      upvotes: typeof s.installs === "number" ? s.installs : undefined,
    });
    const header = [
      `${source.title} — a Claude/agent skill from ${s.source ?? "unknown"}.`,
      s.installs != null ? `Installs: ${s.installs}.` : "",
      s.installUrl ? `Source repo: ${s.installUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { source, readme: readme ? `${header}\n\n${readme}` : header };
  } catch {
    return null;
  }
}

export type SkillsSourceOptions = {
  proxyUrl: string;
  token: string;
  log?: Logger;
  fetchImpl?: typeof fetch;
  /** Cap the pool (each item costs one detail fetch). Default 8. */
  poolSize?: number;
};

export function createSkillsSource(opts: SkillsSourceOptions): DiscoverySource {
  const log = opts.log ?? nullLogger;
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.proxyUrl.replace(/\/+$/, "");
  const sep = base.includes("?") ? "&" : "?";

  async function get(query: string): Promise<unknown> {
    const res = await doFetch(`${base}${sep}${query}`, {
      headers: { Authorization: `Bearer ${opts.token}` },
    });
    if (!res.ok) throw new Error(`skills proxy ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }

  /** Fetch a skill's files for the readme; best-effort (thin readme on failure). */
  async function readmeFor(id: string): Promise<string> {
    try {
      return detailReadme(await get(`detail=${encodeURIComponent(id)}`));
    } catch (err) {
      log.warn(`skills detail failed for ${id}: ${String(err)}`);
      return "";
    }
  }

  return {
    name: "skills",

    async discoverTrending(limit: number): Promise<Discovered[]> {
      const pool = Math.min(limit, opts.poolSize ?? 8);
      try {
        const listings = extractListings(await get(`view=trending&per_page=${pool}`)).slice(
          0,
          pool,
        );
        const out: Discovered[] = [];
        for (const s of listings) {
          const d = s.id ? toDiscovered(s, await readmeFor(s.id)) : null;
          if (d) out.push(d);
        }
        log.info(`skills discovered ${out.length}`);
        return out;
      } catch (err) {
        log.warn(`skills discovery failed: ${String(err)}`);
        return [];
      }
    },

    async resolveUrl(url: string): Promise<Discovered | null> {
      // skills.sh/<owner>/<repo>/<slug>
      const m = url.match(/skills\.sh\/([^/]+\/[^/]+\/[^/?#]+)/i);
      if (!m) return null;
      const id = m[1]!;
      const [owner, repo, slug] = id.split("/");
      return toDiscovered(
        { id, slug, name: slug, source: `${owner}/${repo}`, url },
        await readmeFor(id),
      );
    },
  };
}
