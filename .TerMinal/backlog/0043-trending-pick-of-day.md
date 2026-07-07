---
id: 043
title: "Pick of the Day: rank 20 by trending, dedup, grade top 1, rich Discord post"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-07
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/8"]
refs: [ARCH]
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Discord is the primary channel. The daily scan should surface ONE high-signal
trending pick, delivered as a rich Discord embed.

## Scope
- **Scanner**: fetch ~20 candidates, drop already-graded (new `POST
  /api/internal/items/known`), rank by trending (recent **star velocity**,
  heavily weighted), grade only the top `AIX_TRENDING_PICKS` (default 1). Human
  queue submissions still publish separately.
- **Discord**: digest posts at most 1/day (the highest-scored pick); embed links
  to the AIx item page (`/item/<slug>`), and carries install one-liner,
  adopt-if/skip-if, AI-eng fit, noise.
- **Hardening**: bot deploy `strategy: Recreate` (never two gateway connections)
  + PVC-backed durable digest watermark — the daily post fires exactly once.

## Acceptance
- Ranking, pre-eval dedup, and top-1 selection are unit-tested.
- Digest caps at 1/run and advances the watermark even on empty runs.
- Embed links to the site and shows the decision layer.
- Deploy: one embed per day in #ai-tools, no duplicates across restarts.
