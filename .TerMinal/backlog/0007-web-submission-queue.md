---
id: 007
title: "Web: link-drop suggestion queue (form + API)"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0006]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Users paste a URL (+note) -> submissions as queued. Public form + /api/submissions. Show status on profile. Scanner drains first on next run within the daily cap.

## Acceptance
- Submitting creates a queued row; dupes/invalid flagged with reason.
