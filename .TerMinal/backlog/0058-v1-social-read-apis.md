---
id: 058
title: "Public v1 read APIs for social surfaces (feed, item social, profiles, leaderboard, recap)"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["057"]
acceptance:
  - "GET /api/v1/items/[slug]/social returns takes, nested comment thread, use-this count, vote net (+ viewer state when bearer-authed)"
  - "GET /api/v1/users/[username] returns profile, links, counts, takes, stack, recent activity"
  - "GET /api/v1/leaderboard returns the three web lists (top rated, most discussed, hall of shame)"
  - "GET /api/v1/recap and /api/v1/recap/[date] return recap JSON; /api/v1/recap/archive lists dates"
  - "GET /api/feed accepts bearer auth (mode=following works from mobile)"
  - "All endpoints have route tests (bun test) incl. 404s and unpublished-item exclusion"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

The web app renders social surfaces (takes, comments, profiles, leaderboard,
recap) via direct-DB server components — none of it is reachable as JSON, so a
native client can't achieve parity. Add read-only v1 endpoints mirroring what
the pages query (`lib/queries.ts`, `lib/takes.ts`), public + CORS like the rest
of `/api/v1`. Viewer-specific fields (my vote, am-I-following) light up when a
bearer token (0057) is present. Update `docs/public-api.md`.
