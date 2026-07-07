---
id: 23
title: "Fix scan-run status mismatch, red CI quality job, unreadable score pill"
status: in-progress
priority: critical
horizon: now
hitl: false
type: bug
source: feedback
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Three real defects found in the second-pass audit.

## Scope
- **Scanner scan-run close**: `apps/scanner/src/index.ts` closes successful runs
  with `status:"ok"` but `api/internal/scan-runs/[id]` validates
  `z.enum(["success","error"])` → 400 → run re-closed as error → `process.exit(1)`.
  Every successful daily scan logs as errored and the CronJob pod fails. Align on
  `"success"` end-to-end; fix the fake in `index.test.ts` that masks this (make it
  validate the enum like the server does).
- **CI quality job**: `.github/workflows/ci.yml` runs `bun run format:check` which
  exists nowhere → red on every push. Add prettier config + `format`/`format:check`
  root scripts (prettier is already a devDependency).
- **Score pill**: `bg-black/72` in `components/item-card.tsx` is not a Tailwind
  class (default opacity scale has no 72) → the score stamp renders with NO dark
  background, unreadable on light covers. Use a valid opacity.

## Acceptance
- Failing test reproduces the "ok" rejection; scanner e2e-style unit run closes
  a run as success and exits 0.
- `bun run format:check` passes locally.
- Score pill has a dark backdrop in the rendered DOM (class actually exists).
