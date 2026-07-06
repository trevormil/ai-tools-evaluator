---
id: 27
title: "Ranked density: compact trending rows + numbered leaderboard"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0003]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Two taste failures found in the live review:
- The home sidebar "Trending tools" reuses the full directory ItemCard (16:9
  cover) — four giant cards where Twitter-style compact trend rows belong.
- The leaderboard renders three identical directory grids; ranking is invisible
  (no rank numbers, same 10 cards repeated three times).

## Scope
- **Compact trend row component**: rank number, tiny cover/monogram, title,
  verdict dot, score — one line each. Use in home sidebar (top ~5 hot).
- **Leaderboard as a real leaderboard**: numbered ranked rows per section
  (Top rated / Most discussed / Hall of Shame) with the metric that ranks the
  section displayed prominently (score, comment count, noise). Keep the
  section headers/copy — they're good.

## Acceptance
- Home sidebar shows compact ranked rows; leaderboard shows numbered rows with
  the ranking metric visible; both link to item pages.
