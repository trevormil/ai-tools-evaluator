# AIx

**Every dev tool, on the record — harshly scored, honestly used.**

AIx (`aix.trevormil.com`) is a **directory** of trending dev tools — GitHub
repos, MCP servers, libraries, skills, *and research papers* — where two kinds
of judgment meet on every tool page:

1. **The evaluation.** A strict, deliberately harsh AI write-up: a 10-metric
   scorecard, a forced one-word verdict (`essential` → `complexity-trap`), and
   a devil's-advocate section that asks the only question that matters — **is
   this genuinely worth it, or just complexity for its own sake?** Most repos
   are thin optimizations over what a capable base agent already does; the
   site says so, out loud.
2. **The takes.** Real practitioners' blurbs on how they actually use it —
   `@user's take`, a status (`using` / `trying` / `dropped`), an optional
   ★rating, and a one-tap **"I use this"** count. Takes from people you follow
   sort first.

The loop: **submit a tool → it's live instantly ("Awaiting score…") → like it,
comment, add your take → the evaluation queue fills in the scorecard** on the
same page, with every comment and take intact. A scanner discovers trending
tools daily (capped at **10 new items/day**, dedup-aware) and drains the
community queue first. A Discord bot mirrors it all.

## The surfaces

| Surface        | What it is                                                              |
| -------------- | ----------------------------------------------------------------------- |
| `/`            | The directory: search-first browsing, filters, honest counts, pulse rail |
| `/item/<slug>` | The tool page: evaluation + takes + comments + votes + "I use this"      |
| `/activity`    | New tools + new takes, Everything/Following tabs, cursor pagination      |
| `/leaderboard` | Top rated · Most discussed · the Complexity Trap Hall of Shame           |
| `/submit`      | Drop a URL → live item immediately, evaluation queued                    |
| `/u/<name>`    | Profiles: Takes · My Stack · My Workflow · Articles · Activity           |

## Every evaluation answers

1. **What it is** — plainspoken, no marketing.
2. **How it differs from vanilla Claude** — the real delta, if any.
3. **Skill, plugin, or workflow shift?** — how much of your workflow it changes.
4. **Devil's advocate** — why the base agent can (or soon will) handle this
   itself, and whether it's complexity for complexity's sake. *This leads.*
5. **A 10-metric scorecard** (novelty, utility, delta-vs-baseline, ease,
   maturity, leanness, traction, composability, longevity, clarity), each
   0–100 with a rationale, a weighted **overall score**, an **audience-fit**
   block (AI-engineer vs vibe-coder), and the forced **verdict**.

## Repo layout (bun workspaces)

```
packages/core   strict Evaluation schema + scorecard + verdict + md serializer + eval prompt
packages/db     Drizzle + bun:sqlite schema (users, items, takes/stack, submissions, comments, votes, ...)
apps/web        Next.js 15 — directory, takes, profiles, auth, submission queue, internal + public API
apps/scanner    GitHub + arXiv discovery -> Claude evaluation -> publish/upgrade (k8s CronJob, 10/day cap)
apps/bot        Discord bot — daily digest, /submit, /eval
e2e             Playwright suite against a real, seeded production build
k8s             namespace, web Deployment + PVC + Ingress, scanner/rank/newsletter CronJobs, bot
content/items   git-native .md archive of every published evaluation (derived from the DB)
```

## Develop

```bash
bun install
bun test packages apps        # unit suites (core, db-backed web libs, scanner, bot)
bun run test:e2e              # Playwright against a seeded production build
bun run typecheck             # tsc across the monorepo
bun run format:check          # prettier gate (CI runs this)

# run it locally with demo data + mock sign-in
export AIX_DB_PATH=/tmp/aix-dev.db AIX_DEV_LOGIN=1
bun packages/db/src/migrate.ts && bun run seed
bun run web                   # :3000
open "http://localhost:3000/api/auth/dev?u=you"   # instant session, no OAuth
```

`AIX_DEV_LOGIN=1` enables a dev-only mock sign-in (404s in production —
never set it there). Any `?u=<name>` gets a real session, so multi-user flows
(follows, DMs, takes) are testable across browser profiles.

Architecture: [`docs/architecture.md`](./docs/architecture.md). Decisions:
[`docs/decisions/`](./docs/decisions/). Internal API contract:
[`docs/internal-api.md`](./docs/internal-api.md). Backlog:
[`.TerMinal/backlog/`](./.TerMinal/backlog/).
