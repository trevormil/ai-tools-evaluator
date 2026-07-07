---
id: 31
title: "Hardening follow-ups: media mirroring, ban tool, internal-API + db tests, health probe"
status: open
priority: medium
horizon: next
hitl: false
type: chore
source: feedback
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0006, 0011, 0015]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Bundled smaller gaps from the infra audit (each real, none urgent):

- **Media mirroring (0011 scope)**: `cachedUrl` is never populated — covers
  hotlink opengraph.githubassets.com / placehold.co, so external availability
  is our uptime. Mirror to Spaces on publish.
- **Ban tool (0015 scope)**: only `hide` exists; add banned flag + admin route
  + enforcement in `requireUser`.
- **Tests**: internal API routes (401/publish/drain), auth session round-trip,
  @aix/db smoke insert/read (0001 acceptance bullet never got a db-side test).
- **k8s health probe**: probes hit `/` (dynamic DB render per liveness check);
  add a cheap `/api/health` and point probes at it.

## Acceptance
- Published items get a mirrored cover URL; banned user's session is refused;
  new tests green; probes use /api/health.
