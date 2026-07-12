# AIx

**Every dev tool, on the record — harshly scored.**

AIx (`aix.trevormil.com`) is a **static, git-native directory** of trending dev
tools — GitHub repos, MCP servers, libraries, skills, *and research papers* —
where every tool page carries one thing: a strict, deliberately harsh AI
evaluation. A 10-metric scorecard, a forced one-word verdict (`essential` →
`complexity-trap`), and a devil's-advocate section that asks the only question
that matters — **is this genuinely worth it, or just complexity for its own
sake?** Most repos are thin optimizations over what a capable base agent already
does; the site says so, out loud.

The loop: a daily scanner discovers trending tools (capped at **10 new items/day**,
dedup-aware), drains the community submission queue first, evaluates each with
Claude, and writes a `content/items/<slug>.md` artifact. That commit rebuilds the
static site. **No server, no database, no social layer** — git is the source of
truth (see [ADR-0004](./docs/decisions/0004-aix-static-git-native.md)).

## The surfaces

| Surface        | What it is                                                          |
| -------------- | ------------------------------------------------------------------- |
| `/`            | The directory: client-side search, filters, honest counts          |
| `/item/<slug>` | The tool page: evaluation, scorecard, README, spec rail             |
| `/leaderboard` | Top rated · the Complexity Trap Hall of Shame                       |
| `/recap`       | The nightly recap — the day's verdicts, editorially framed          |
| `/submit`      | Drop a GitHub URL → queued for the next scan                        |
| `/api/v1/*.json` | Static public API (item list, per-item, full dump) for the iOS app |

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
packages/core   strict Evaluation schema + scorecard + verdict + md (de)serializer + eval prompt
packages/db     Drizzle schema — the Item type + the local seed (authors example .md); not used at runtime
apps/web        Next.js 15 STATIC export — directory (client search), item pages, recap, public API v1
apps/scanner    GitHub/arXiv/ProductHunt discovery -> Claude eval -> writes .md -> commits (Actions cron)
workers/submit  Cloudflare Worker — "submit a URL" -> content/queue/*.json via the GitHub API
content/items   the git-native .md corpus — SOURCE OF TRUTH (each an evaluation + canonical JSON block)
content/queue   pending submissions awaiting the next scan
e2e             Playwright suite against a real, seeded production build
```

## Develop

```bash
bun install
bun test packages apps workers   # unit suites (core, web libs, scanner, worker)
bun run typecheck                # tsc across the monorepo
bun run format:check             # prettier gate (CI runs this)

# author the example corpus, then run the static site locally
bun run seed                     # writes content/items/*.md
bun run web                      # :3000 (reads the corpus)
```

## Deploy (all free tier)

- **Site** — Cloudflare Pages, build `cd apps/web && bun run build`, output `apps/web/out`.
- **Scanner** — GitHub Actions cron (`.github/workflows/scan.yml`); set the
  `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` (+ optional `PRODUCTHUNT_API_TOKEN`,
  `DISCORD_WEBHOOK_URL`) repo secrets.
- **Submissions** — `cd workers/submit && wrangler deploy`; `wrangler secret put
  GITHUB_TOKEN`; point `NEXT_PUBLIC_SUBMIT_URL` at the Worker.

Architecture: [`docs/architecture.md`](./docs/architecture.md). Decisions:
[`docs/decisions/`](./docs/decisions/). Backlog:
[`.TerMinal/backlog/`](./.TerMinal/backlog/).
