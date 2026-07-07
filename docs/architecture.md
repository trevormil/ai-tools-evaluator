---
anchor: ARCH
---

# AIx — Architecture

**AIx** (`aix.trevormil.com`) is a dual product:

1. **A directory** of trending GitHub repos, tools, MCPs, libraries, skills, and
   research papers — each distilled into a strict, harshly-honest evaluation
   artifact that leads with _"is this actually worth it, or complexity for its
   own sake?"_
2. **The takes around them** — per-tool practitioner blurbs (`@user's take`,
   status, ★rating), a one-tap "I use this" count, comments, votes, follows,
   DMs. Directory-first: the home page IS the directory; the timeline is a
   secondary surface at `/activity`. There is no generic post composer
   (legacy posts still render).

A scanner auto-scans multiple sources daily (capped at 10 new items/day,
dedup-aware) and publishes evaluations. Anyone can submit a URL: the tool
appears in the directory INSTANTLY as a pending item (`scoreStatus="pending"`,
"Awaiting score…", socially live) and the scanner upgrades the same row in
place when the evaluation lands — comments/takes/votes survive.

## [1] Topology

- Ingress (nginx + cert-manager) terminates TLS for `aix.trevormil.com`.
- `web` Deployment (Next.js, **replicas: 1**) owns the SQLite file on a PVC.
- `scanner` CronJob (daily) and `bot` Deployment never touch the DB file — they
  call `web`'s authenticated internal API (`/api/internal/*`, shared secret).

**Single-writer rule.** SQLite lives on a `ReadWriteOnce` PVC mounted only by the
`web` pod. This sidesteps multi-writer SQLite corruption while keeping the "just
SQLite" simplicity.

## [2] Packages & apps (bun workspaces)

| Path | Role |
| --- | --- |
| `packages/core` | Strict `Evaluation` schema, 10-metric scorecard, verdict enum, categories, markdown (de)serializer, evaluator prompt. **The shared contract.** |
| `packages/db` | Drizzle + `bun:sqlite` schema + migrator. |
| `apps/web` | Next.js 15 (App Router) — directory-first home (search + filters incl. audience), item pages (scorecard + **takes** + "I use this" + comments + repo README), `/activity` timeline, `/recap` nightly recap, **profiles** (Takes · My Stack · Activity), GitHub OAuth (+ gated dev login), instant submissions, public API v1 + internal API. |
| `apps/scanner` | Multi-source discovery (GitHub, arXiv) + queue drain -> Claude evaluation -> publish. k8s CronJob. |
| `apps/bot` | Discord bot — daily + weekly digests, `/submit`, `/eval`, `/leaderboard`. |
| `ios` | Native SwiftUI iOS client reading the public API v1 (directory, item detail, leaderboard). |
| `k8s` | Namespace, web Deployment/Service/Ingress, PVC, scanner + rank CronJobs, bot Deployment, secrets. |

Social/content tables (`packages/db`): `posts`, `comments`, `votes` (likes),
`reposts`, `messages` (DMs), `activities` (feed events), `notifications`,
`follows`, `stack_items` (My Stack), `articles` (long-form + My Workflow),
`subscribers` (newsletter).

## [3] Data model

SQLite is the **source of truth**. Each published evaluation is _also_ exported
as a strict `.md` artifact (`@aix/core` `toMarkdown`) into `content/items/` for a
git-native archive — human-readable with an embedded canonical JSON block so it
round-trips. Tables in `packages/db/src/schema.ts`.

The evaluation (`packages/core/src/schema.ts`) is the strict document: closed-enum
category + integration, forced `verdict`, 10-metric scorecard with per-metric
rationale + weighted `overallScore`, `noiseScore`, and five required plaintext
sections — `whatItIs`, `vsVanilla`, `surfaceArea`, `devilsAdvocate`, optional
`steelman`.

## [4] The scan pipeline (daily cap = 10)

1. **Drain the suggestion queue first** — `submissions` with `status=queued`,
   oldest first, up to the daily budget.
2. **Trending discovery** fills the remainder — GitHub search (recently-created +
   fast-rising stars), arXiv recent listings.
3. **Dedup** — skip anything already in `items` (`kind`+`externalId` unique).
4. **Evaluate** — fetch README/abstract, call Claude with the skeptic prompt,
   validate against `EvaluationDraft`, recompute `overallScore`.
5. **Attach media** — repo social-preview / screenshots / README images; fall
   back to a generated cover.
6. **Publish** — insert `items`, write `.md` artifact, post to the bot channel,
   mark the originating `submission` as `published`.

Every run is recorded in `scan_runs` for cap accounting and observability.

## [5] Rate-limit resilience

GitHub is the tight constraint. The scanner uses an authenticated Octokit token,
conditional requests + ETags, exponential backoff on secondary limits, and caps
per-run API calls. Discovery is windowed (rotating search facets). arXiv is
polled politely (<=1 req/3s).

## [6] Related decisions

- [ADR-0002](./decisions/0002-aix-stack.md) — stack, storage, and topology.
