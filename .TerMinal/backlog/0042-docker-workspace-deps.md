---
id: 042
title: "Fix scanner/bot Docker images: bundle per-workspace node_modules"
status: closed
priority: critical
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-07
updated: 2026-07-07
prs: []
refs: [ARCH]
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

First live scan + bot crashlooped: `Cannot find package 'zod'` (scanner) and
`Cannot find package 'discord.js'` (bot). `Dockerfile.scanner`/`Dockerfile.bot`
runtime stages copied only root `/app/node_modules`, but bun installs each
workspace member's deps into its **own** `node_modules` (e.g.
`apps/scanner/node_modules/zod`). Those never reached the runtime image.
`Dockerfile.web` was correct — it copies the whole tree (`COPY --from=build /app /app`).

## Fix
Scanner + bot: add a `build` stage (`deps` + `COPY . .`) and have runtime
`COPY --from=build /app /app` (mirrors web). PR #5.

## Acceptance
- Built image resolves scanner deps (zod/@octokit/@anthropic-ai/@aix/core) and
  bot's discord.js; container runs past module resolution to env validation.
- Verified locally via `docker build` + `docker run` before merge.
- After merge + rebuild: `aix-scanner-manual` completes; `aix-bot` reaches Ready.
