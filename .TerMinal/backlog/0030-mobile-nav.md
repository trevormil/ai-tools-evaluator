---
id: 30
title: "Mobile bottom tab bar (Feed · Directory · Submit · Alerts · Profile)"
status: closed
priority: medium
horizon: next
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0002]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

At 375px the header crams 6 nav links + bell + theme + avatar into one row —
tiny tap targets, no thumb reach. A social feed app should follow the mobile
convention: fixed bottom tab bar (Feed, Directory, Submit, Notifications,
Profile), header reduced to brand + theme on small screens.

## Acceptance
- <640px: bottom tab bar visible with active-tab state, header simplified;
  ≥640px unchanged. No layout shift/overlap with feed content (safe-area pad).
