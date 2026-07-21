---
id: 066
title: "Seed script fails schema validation — Playwright e2e suite can't start (pre-existing on main)"
status: closed
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-20
updated: 2026-07-21
prs: []
refs: []
depends_on: []
acceptance:
  - "bun packages/db/src/seed.ts completes against a fresh DB"
  - "bun run test:e2e boots the seeded web server and the suite runs"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

`packages/db/src/seed.ts:282` throws a zod validation error parsing its demo
evaluations, so the Playwright `test:e2e` web server never boots. Reproduced
on 2026-07-20 with code byte-identical to `main` (feat/ios-parity touches
nothing under `packages/`), so this is pre-existing — most likely the strict
schema gaining a required `body.whatWouldMakeItBetter` (commit 39a1e2b /
PR #55 era) without the seed fixtures being updated.

Fix: update the seed evaluations to the current `@aix/core` schema, and add a
unit test that round-trips every seed evaluation through the schema so seed
drift fails fast in `bun test` instead of only in e2e.
