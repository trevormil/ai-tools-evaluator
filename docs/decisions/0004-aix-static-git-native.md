---
id: 0004
title: AIx v2 — static git-native directory, no server
anchor: ADR-0004
status: accepted
date: 2026-07-12
supersedes: ADR-0002
superseded-by:
---

## [1] Context

[ADR-0002](./0002-aix-stack.md) shipped AIx as a dual **directory + social**
product on Kubernetes: a Next.js `web` pod owning a SQLite file on a
`ReadWriteOnce` PVC (single writer, `replicas: 1`), a `scanner` CronJob, and a
long-lived Discord `bot` Deployment. That topology exists almost entirely to
serve **live user writes** — GitHub OAuth sessions, votes, comments, per-tool
"takes", DMs, follows, the activity feed, profiles, the newsletter, and
profile-pic uploads to DigitalOcean Spaces.

Two problems drove this revision:

- **Cost + operational weight.** A k8s cluster (nginx ingress + cert-manager +
  a PVC + an always-on bot Deployment) is heavy and >$5/mo for a project at this
  scale. `web` also can't run under Bun (RSS leak under `next start` OOM-looped
  and forced a second node — see the Node-runtime fix, commit `f67fc1d`).
- **The social product isn't what we want to carry.** Maintaining a social
  surface (auth, moderation, abuse, concurrent writes) is the bulk of the
  maintenance cost for the least of the value. The valuable core is the
  **directory + the harsh AI evaluation** of each item.

Key realization: **with the social surface removed, there are no live user
writes.** The only writer is the scanner, once a day, in a batch. A site whose
data changes once a day and where nobody writes from a browser is a **static
site** — which unlocks free CDN hosting, no database at runtime, and no
always-on process.

## [2] Decision

Rebuild AIx as a **static, git-native directory** with zero always-on infra.

- **Source of truth = git.** Promote `content/items/*.md` (today a *derived*
  archive per ADR-0002#3) to the **primary** store. Each item is one markdown
  file with an embedded canonical `@aix/core` JSON block. Runtime SQLite is
  **removed** from the web app; a build step reads the `.md` corpus into a JSON
  index. Any scanner-side dedup/cap bookkeeping uses a throwaway local file, not
  a served database.
- **Static site on Cloudflare Pages.** `apps/web` becomes a static export
  (`next.config` `output: 'export'`). Search/filter is **client-side** over a
  prebuilt index. The iOS public API v1 becomes static JSON
  (`/api/v1/*.json`) on the CDN. Served by Cloudflare's edge — free, external.
- **Scanner runs as a GitHub Actions scheduled cron.** The daily discovery →
  Claude eval → publish pipeline runs in CI, writes `.md` files, commits, and
  `git push`. The push triggers the Pages build + deploy. Secrets
  (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`) live in Actions secrets. No always-on
  machine anywhere.
- **Submissions via a Cloudflare Worker form.** A free Worker receives the
  "submit a URL" POST from the site and writes a queue file into
  `content/queue/` via the GitHub API. The scanner drains the queue first on its
  next run (unchanged queue semantics).
- **Discord = webhook digest.** After a run, the scanner POSTs a **single**
  digest to a Discord webhook URL. The interactive bot (`apps/bot`) is deleted —
  no websocket process, no slash commands.

## [3] Consequences

- **~$0/mo** (domain + Anthropic inference aside). Cloudflare Pages, Actions
  cron, git storage, and either R2 or GitHub OpenGraph hotlinking (in place of
  Spaces) are all free tier.
- **No server, no port, nothing kept alive.** The whole k8s topology, the PVC,
  the single-writer rule, the internal write API, and the bot Deployment are
  retired.
- **The social product is gone.** Votes, comments, takes, DMs, follows, feed,
  profiles, newsletter, and auth are removed. If lightweight engagement is
  wanted later, Giscus (GitHub-Discussions-backed comments) can bolt onto the
  static site without resurrecting a server.
- **Data volume is fine for git.** At the 10/day cap that's ~3.6k small `.md`
  files/year; git and a build step handle this comfortably.
- **Freshness is batch, not live.** The site updates once per scan (daily) via a
  git push → rebuild. Acceptable — the product is a curated directory, not a
  live feed.
- **The submission Worker is the one piece of server-side code.** It's
  serverless/free and its only job is to append a queue file — a small, bounded
  surface.

## [4] Conflicts resolved

- **C1 — where the data lives:** git `.md` corpus (primary) over SQLite-on-PVC.
  Chosen because a read-only public site has no need for a runtime relational
  DB, and we already produce the `.md` corpus.
- **C2 — how the site is served:** static CDN (Cloudflare Pages) over an
  always-on Next.js server. Chosen because there are no live writes to serve.
- **C3 — where the scanner runs:** GitHub Actions cron over a personal-desktop
  (`tm`) cron. The `tm` box must not serve externally and can sleep/power off;
  Actions is reliable, free, and needs no always-on machine. (`tm`-cron remains
  a fallback if keys must stay off GitHub runners.)
- **C4 — Discord:** webhook digest over the always-on bot. Chosen to eliminate
  the only remaining long-lived process; slash commands are dropped.

## [5] Unchanged and still binding

- **The `@aix/core` strict `Evaluation` schema** (ADR-0003 lenses, the
  10-metric scorecard, forced verdict, devil's-advocate) is untouched — it's the
  product's core and the `.md` artifact format.
- The human-only merge gate (global §8) and TDD-first gate remain.
- Bun + TypeScript everywhere for authoring/build; the web app's Node runtime
  requirement (better-sqlite3, commit `f67fc1d`) is moot once runtime SQLite is
  removed.

## [6] Superseded decisions

| Prior (ADR-0002) | Was | Now | Why |
|---|---|---|---|
| Storage topology | SQLite on RWO PVC, single writer | git `.md` corpus, build-time JSON index | No live writes → no runtime DB |
| Source of truth | DB primary, `.md` derived | `.md` primary, JSON index derived | Removes a whole layer |
| Web serving | Next.js SSR pod on k8s | static export on Cloudflare Pages | No live writes to serve |
| Scanner | k8s CronJob → internal write API | GitHub Actions cron → git push | No always-on cluster |
| Auth | GitHub OAuth + server sessions | removed | No social surface to gate |
| Discord | discord.js bot Deployment | scanner → webhook digest | No always-on process |
| Media | DigitalOcean Spaces uploads | git / GitHub OpenGraph hotlink (or R2) | No profile pics; free |
