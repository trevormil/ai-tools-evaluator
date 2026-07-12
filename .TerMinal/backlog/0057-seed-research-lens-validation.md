---
id: 0057
title: "seed: research-lens evals fail Evaluation.parse (missing body.vsPriorWork)"
status: open
priority: low
horizon: next
hitl: false
type: bug
source: manual
created: 2026-07-12
updated: 2026-07-12
prs: []
refs: [ADR-0003, ADR-0004]
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

`bun run seed` (packages/db/src/seed.ts) throws a ZodError: `body.vsPriorWork
is required for the "research" lens`. The hand-authored research-kind
evaluation(s) (e.g. react-reasoning-and-acting) predate the ADR-0003 per-lens
validation and never got a `vsPriorWork` section, so re-running the seed now
fails on Evaluation.parse.

**Pre-existing** — present on `main`, not introduced by the v2 pivot (found
during ADR-0004 phase 2). Low priority because the seed is dev-only; the
committed content/items/*.md were generated before the rule landed.

Fix: add the required `vsPriorWork` body section to the research-lens seed
evals so the seed validates, and regenerate their .md artifacts.
