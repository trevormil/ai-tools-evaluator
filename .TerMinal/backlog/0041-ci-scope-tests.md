---
id: 041
title: "Fix red main CI: scope Tests to bun run test (exclude Playwright e2e)"
status: in-progress
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-07
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/2"]
refs: []
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Main went red on the foundation merge (PR #1). CI's `quality` job `Tests` step
ran bare `bun test`, which discovers the `e2e/` Playwright specs. Those use
Playwright's runner + a live server and error under bun's runner (7 fail /
7 errors), while `bun test packages apps` (the project's `test` script) is green.

## Fix
`.github/workflows/ci.yml` — `run: bun test` → `run: bun run test`. e2e keeps its
own `test:e2e` (Playwright) job. PR #2.

## Acceptance
- `bun run test` green (118 pass); `format:check` clean.
- CI `quality` passes on PR #2 → main green after merge.
