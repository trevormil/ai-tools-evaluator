---
id: 062
title: "iOS: nightly recap browser (pushed from the feed's recap strip)"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["058", "059"]
acceptance:
  - "Feed shows a compact 'last night's recap' strip (count + verdict summary) that pushes the full recap"
  - "Recap screen: latest nightly recap (lead pick, callout, top adopted, everything judged), prev/next date navigation, archive sheet"
  - "Links through to item detail; empty/404 states are friendly"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Web reference: `/recap*`. Read-only mirror over the 0058 endpoints.

*(Rescoped 2026-07-20 twice: notification inbox + DMs dropped with the
read-only pivot; then the Leaderboard tab was dropped entirely and the Recap
tab folded into a feed strip per Trevor's UX pass — 3 tabs total.)*
