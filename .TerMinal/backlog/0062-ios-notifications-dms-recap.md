---
id: 062
title: "iOS: three-list leaderboard + nightly recap browser"
status: in-progress
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/56"]
refs: []
depends_on: ["058", "059"]
acceptance:
  - "Leaderboard tab shows the three web lists (top rated ranked, most discussed, complexity-trap hall of shame) from /api/v1/leaderboard"
  - "Recap tab: latest nightly recap (lead pick, callout, top adopted, everything judged), prev/next date navigation, archive sheet"
  - "Both link through to item detail; empty/404 states are friendly"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Web reference: `/leaderboard` and `/recap*`. Read-only mirrors over the 0058
endpoints.

*(Rescoped 2026-07-20: notification inbox + DMs dropped with the read-only
pivot — replaced by 065's local daily-pick reminder.)*
