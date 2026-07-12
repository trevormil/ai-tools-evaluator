---
id: 0058
title: "web: remove now-unreachable pending-item UI branches"
status: open
priority: low
horizon: next
hitl: false
type: chore
source: manual
created: 2026-07-12
updated: 2026-07-12
prs: []
refs: [ADR-0004]
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Since ADR-0004 phase 3, the web read layer loads only scored items from the git
corpus (`scoreStatus` is always "scored"), and submitted-but-unscored URLs show
in the QueueStrip instead. The old `pending` branches in
`components/item-row.tsx` and `app/item/[slug]/page.tsx` (the "Awaiting score…"
chips, the pending Status tab, the pending readout) are now unreachable.

Low-risk cleanup: delete the inert `pending` branches so the components read
straight. Left in during the phase-3 source swap to keep that diff focused on
the data layer.
