---
id: 086
title: "runDry ignores the master AIX_TRENDING_PICKS cap (per-source budgets only)"
status: open
priority: low
horizon: next
hitl: false
type: bug
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: []
refs: ["055"]
depends_on: []
acceptance:
  - "A dry run with AIX_TRENDING_PICKS=N evaluates at most N trending candidates across sources, mirroring the real loop"
  - "A unit test pins it"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Observed in the 2026-08-02 prod dry-run sample: AIX_TRENDING_PICKS=4 but runDry
evaluated 8 (5 GitHub + 3 ProductHunt) — it slices per-source `src.budget` and
never consults `deps.trendingCap`. Harmless in a no-publish path but costs
model calls and diverges from the real loop's accounting.
