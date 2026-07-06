# AIx

**Discover the fast-moving world of dev tools — then argue about them.**

AIx (`aix.trevormil.com`) is two things in one:

1. **A directory** of trending GitHub repos, tools, MCP servers, libraries,
   skills, integrations — *and research papers* — each distilled into a strict,
   deliberately harsh evaluation. Every artifact leads with the question that
   actually matters: **is this genuinely worth it, or just complexity for its own
   sake?** Most repos are thin optimizations over what a capable base agent
   already does; the site says so, out loud.
2. **A social site** around them — Twitter-like posts, profiles, comments,
   discussions, and votes.

A bot scans multiple sources every day (capped at **10 new items/day**,
dedup-aware) and posts evaluations. Anyone can drop a link into a **suggestion
queue** that the bot drains first on its next run. A Discord bot mirrors it all —
submit links, get the daily digest, look up evaluations.

## Every evaluation answers

1. **What it is** — plainspoken, no marketing.
2. **How it differs from vanilla Claude** — the real delta, if any.
3. **Skill, plugin, or workflow shift?** — how much of your workflow it changes.
4. **Devil's advocate** — why the base agent can (or soon will) handle this
   itself, and whether it's complexity for complexity's sake. *This leads.*
5. **A 10-metric scorecard** (novelty, utility, delta-vs-baseline, ease, maturity,
   leanness, traction, composability, longevity, clarity) each 0-100 with a
   rationale, plus a weighted **overall score** and a forced one-word **verdict**
   (essential -> complexity-trap).

## Repo layout (bun workspaces)

```
packages/core   strict Evaluation schema + scorecard + verdict + md serializer + eval prompt
packages/db     Drizzle + bun:sqlite schema (users, items, submissions, posts, comments, votes, ...)
apps/web        Next.js 15 - directory, social feed, profiles, auth, submission queue, internal API
apps/scanner    GitHub + arXiv discovery -> Claude evaluation -> publish (k8s CronJob, 10/day cap)
apps/bot        Discord bot - daily digest, /submit, /eval
k8s             namespace, web Deployment + PVC + Ingress, scanner CronJob, bot Deployment
content/items   git-native .md archive of every published evaluation (derived from the DB)
```

## Develop

```bash
bun install
bun test                                 # core foundation tests
cd packages/db && bun src/migrate.ts     # apply migrations to ./aix.db
bun run web                              # Next.js dev server on :3000
```

Architecture: [`docs/architecture.md`](./docs/architecture.md). Decisions:
[`docs/decisions/`](./docs/decisions/). Internal API contract:
[`docs/internal-api.md`](./docs/internal-api.md). Backlog:
[`.TerMinal/backlog/`](./.TerMinal/backlog/).
