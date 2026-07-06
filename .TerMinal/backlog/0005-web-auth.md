---
id: 005
title: "Web: GitHub OAuth + server sessions"
status: open
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

GitHub OAuth, opaque server sessions in sessions table, session cookie, getCurrentUser(), sign-in/out, upsert users row on first login.

## Acceptance
- OAuth round-trip creates a user + session; protected mutations require a session.
