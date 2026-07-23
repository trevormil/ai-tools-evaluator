---
id: 77
title: "Daily digest double-posted: unserialized non-atomic .state.json writes race between the two bot schedulers"
status: in-progress
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-07-23
updated: 2026-07-23
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/76"]
refs: []
depends_on: []
acceptance:
  - "All .state.json reads/writes go through a serialized (mutexed) accessor — concurrent writeState calls can no longer lose an update"
  - "State file writes are atomic (write temp + rename), so a concurrent read can never observe a torn/partial JSON file"
  - "A test drives runDigest and runSubmissionDigest concurrently against one state path and asserts the once-per-day guard survives (exactly one pick posted across subsequent ticks)"
  - "Unknown legacy keys in the state file (e.g. lastWeeklyPostedAt) still round-trip through the new write path"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

On 2026-07-23 the Discord bot posted **two** daily picks: 13:02:32 UTC
(LightRAG) and 13:12:32 UTC (graphify) — confirmed via the Discord API. One
pod, zero restarts, so this is not the old OOMKill duplicate (#27).

Root cause: `startDigestScheduler` and `startSubmissionDigestScheduler` are
started together in `apps/bot/src/index.ts` and tick at the same instants
every 5 minutes. Both mutate the same `.state.json` through
`writeState` (`apps/bot/src/state.ts`), which is an **unlocked
read-merge-write** on top of a **non-atomic `writeFile`**. The submission
poller writes on every empty poll, so a write concurrent with the daily
pick's `writeLastPickDate`/`writeLastPosted` is guaranteed at post time.
Either a lost update (stale merge base clobbers `lastPickDate`) or a torn
read (`readState` swallows the parse error of a half-written file and
returns `{}`) erased the once-per-day guard, and the next tick re-posted
with a rolled-back watermark. Post-mortem state showed only the second
post's writes survived (`lastPostedAt: 13:12:32`, `lastPickDate` intact).

Fix: serialize all state access behind one in-process promise-chain mutex
and make the write atomic (temp file + `rename`). Both schedulers live in
one process, so no cross-process locking is needed.
