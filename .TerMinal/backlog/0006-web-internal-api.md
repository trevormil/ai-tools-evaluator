---
id: 006
title: "Web: authenticated internal API for scanner + bot writes"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0002]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

/api/internal/* guarded by AIX_INTERNAL_TOKEN shared secret. Endpoints: publish item, enqueue submission, list queued, mark processed, daily-cap accounting, digest data.

## Acceptance
- No token => 401; scanner + bot publish + drain via HTTP only.
