---
id: 044
title: "Daily pick: gate on pick history + scope discovery to AI/LLM repos"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-07
updated: 2026-07-20
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/23"]
refs: [ARCH]
depends_on: [043]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Follow-up to [[0043]] from live operation. Two defects surfaced during a smoke
test:

1. **Daily-pick budget counted the wrong thing.** The cap counted "non-submission
   items created today", so 12 seed/backfill rows saturated `DAILY_CAP` and no
   fresh pick could publish. Root cause: gating on raw item-created-today instead
   of actual daily picks.
2. **Discovery wasn't AI-scoped.** A non-AI repo (`shpigford/knockoff`, a Rails
   card-game clone) was selected as the daily pick. Discovery was deliberately
   broad ("any notable repo").

## Scope
- **`items.dailyPickAt`** (new column + migration 0010). Stamped only on the
  scanner's trending publish (no submissionId) — null for seed rows, community
  submissions, and runners-up.
- **Cap** (`/api/internal/cap`): trending budget = count of `dailyPickAt` today,
  not "items created today". Seed/backfill/submissions never saturate it.
- **Gate semantics**: a repo is never re-featured (past picks stay out via the
  existing pre-eval dedup), while a prior runner-up — never graded, so never
  "known" — can still win when it climbs.
- **AI/LLM discovery scope**: every GitHub search facet is topic-scoped to an AI
  topic; a relevance filter (`isAiRelevant`) drops anything a loose topic
  surfaces before it costs a README fetch or an evaluation.

## Acceptance
- Cap counts picks (dailyPickAt), proven seed rows + submissions don't inflate it.
- A trending publish stamps dailyPickAt; a submission publish does not.
- `isAiRelevant` keeps AI repos and drops non-AI ones; a non-AI repo clearing the
  stars gate is dropped before its README is fetched.
- Migration applies cleanly on the live PVC DB.
