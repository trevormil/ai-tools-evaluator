---
anchor: ARCH
---

# AIx — Architecture

**AIx** (`aix.trevormil.com`) is a **static, git-native directory** of trending
GitHub repos, tools, MCPs, libraries, and research papers — each distilled into a
strict, harshly-honest evaluation that leads with _"is this actually worth it, or
complexity for its own sake?"_ There is no social layer and no database: the site
is a static export, the data lives in git, and the only moving parts are a daily
scanner and a tiny submission Worker.

See [ADR-0004](./decisions/0004-aix-static-git-native.md) — the pivot that
established this architecture (superseding the original k8s + SQLite + social
design in [ADR-0002](./decisions/0002-aix-stack.md)).

## [1] Topology

```
  GitHub Actions (daily cron)        git repo (source of truth)      Cloudflare Pages
  ┌────────────────────────┐  commit ┌──────────────────────┐  push  ┌──────────────────┐
  │ drain content/queue/ → │ ──────► │ content/items/*.md   │ ─────► │ static site      │
  │ discover trending →    │  + push │ content/queue/*.json │  build │ /api/v1/*.json   │
  │ Claude eval → .md      │         └──────────────────────┘        └──────────────────┘
  │ POST 1 Discord webhook │                   ▲                      served free by CDN
  └────────────────────────┘                   │ writes queue file
                                      ┌───────────────────────┐
                                      │ Cloudflare Worker      │ ◄── "submit a URL" from the site
                                      │ (workers/submit)       │
                                      └───────────────────────┘
```

- **No server, no database, nothing always-on.** The site is a static export
  served by Cloudflare Pages' edge. Reads happen at build time from the git
  corpus; the browser filters/searches client-side.
- **Git is the source of truth.** Each evaluation is a `content/items/<slug>.md`
  artifact with an embedded canonical JSON block (the `@aix/core` `Evaluation`).
- **The scanner is a GitHub Actions cron** — it writes `.md` files, commits, and
  pushes; the push triggers the Pages rebuild + deploy.
- **Submissions** flow through a free Cloudflare Worker that appends a
  `content/queue/*.json` file via the GitHub API; the scanner drains it next run.

## [2] Packages & apps (bun workspaces)

| Path | Role |
| --- | --- |
| `packages/core` | Strict `Evaluation` schema, 10-metric scorecard, verdict enum, per-type lenses (ADR-0003), markdown (de)serializer (`toMarkdown`/`parseArtifact`), evaluator prompt, submission validator. **The shared contract.** |
| `packages/db` | Drizzle schema — retained for the `Item` **type** and the local `seed` that authors example `.md` artifacts. Not used at runtime. |
| `apps/web` | Next.js 15 **static export** (`output: "export"`) — directory-first home (client-side search over the prebuilt corpus), item pages (scorecard + README), `/recap`, `/leaderboard`, `/submit`, static public API v1 (`/api/v1/*.json`). No server, no DB. |
| `apps/scanner` | Daily discovery (GitHub, arXiv, ProductHunt) + queue drain → Claude evaluation → writes `.md` → commits + pushes → one Discord webhook digest. Runs as a **GitHub Actions cron** (`.github/workflows/scan.yml`). |
| `workers/submit` | Cloudflare Worker — turns a "submit a URL" POST into a `content/queue/*.json` file via the GitHub Contents API. The one piece of server-side code. |
| `ios` | Native SwiftUI client reading the static public API v1. |

## [3] Data model

Git is the source of truth. Each published evaluation is a strict `.md` artifact
in `content/items/` — human-readable body plus an embedded canonical JSON block
(`@aix/core` `toMarkdown`) that round-trips via `parseArtifact`. The web app
parses the corpus at build (`apps/web/lib/corpus.ts` → `Item[]`); the scanner
reads it for dedup (`apps/scanner/src/store.ts`).

Pending submissions live as `content/queue/*.json` (`{ url, note?, source,
submittedAt }`) until the scanner evaluates them; a lightweight "in the queue"
strip surfaces them in the meantime.

The evaluation (`packages/core/src/schema.ts`) is the strict document: closed-enum
category + integration, forced `verdict`, 10-metric scorecard with per-metric
rationale + weighted `overallScore`, `noiseScore`, and the per-lens plaintext
sections.

## [4] The scan pipeline (daily, in CI)

1. **Drain the queue first** — read `content/queue/*.json` oldest-first, up to the
   daily cap; resolve + evaluate each, write its `.md`, delete the queue file.
2. **Trending discovery** fills the remainder — GitHub (recently-created +
   fast-rising) and ProductHunt; arXiv resolves explicit paper submissions.
3. **Dedup** — skip anything whose `source.externalId` already has a `.md`.
4. **Evaluate** — fetch README/abstract, call Claude with the skeptic prompt,
   validate against the schema, recompute `overallScore`.
5. **Publish** — write `content/items/<slug>.md`; the highest-scored item of the
   run is the featured pick.
6. **Notify + deploy** — POST one Discord webhook digest (the pick), then commit +
   push; the push triggers the Cloudflare Pages rebuild.

## [5] Rate-limit resilience

GitHub is the tight constraint. The scanner uses an authenticated token,
conditional requests + ETags, exponential backoff on secondary limits, and caps
per-run API calls. Discovery is windowed (rotating search facets). arXiv is polled
politely (≤1 req/3s).

## [6] Related decisions

- [ADR-0004](./decisions/0004-aix-static-git-native.md) — static git-native
  directory (current architecture).
- [ADR-0003](./decisions/0003-evaluation-lenses.md) — per-type evaluation lenses.
- [ADR-0002](./decisions/0002-aix-stack.md) — original k8s + SQLite + social
  stack (**superseded** by 0004).
