---
id: 058
title: "Public v1 read APIs for the iOS app: leaderboard, recap, daily pick, item README"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: []
acceptance:
  - "GET /api/v1/leaderboard returns the three web lists (top rated, most discussed, hall of shame)"
  - "GET /api/v1/recap and /api/v1/recap/[date] return recap JSON; /api/v1/recap/archive lists dates"
  - "GET /api/v1/daily-pick returns the newest published daily pick (404 before the first pick)"
  - "GET /api/v1/items/[slug] also returns readmeMd for the README tab"
  - "All endpoints have route tests (bun test) incl. 404s and unpublished-item exclusion"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

The web app renders leaderboard/recap via direct-DB server components — not
reachable as JSON for the read-only iOS client. Add thin public v1 routes over
the existing libs (`lib/leaderboard.ts`, `lib/recap.ts`), CORS + edge-cache
like the rest of `/api/v1`. The anonymous `/api/feed` endpoint already serves
the home timeline as JSON, so the feed needs no server work. Update
`docs/public-api.md`.

*(Rescoped 2026-07-20: originally included item social/profile endpoints +
bearer viewer state — dropped with the read-only app pivot.)*
