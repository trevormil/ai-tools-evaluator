---
id: 32
title: "Pivot: directory-first — home IS the directory; timeline demotes to /activity"
status: closed
priority: critical
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0024, 0027]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Direction change (supersedes 0024's feed-first home): AIx is a DIRECTORY
application, not a scroll app. Users search/browse tools; social lives inside
each tool (and on a secondary activity page), not as the spine.

## Scope
- **/ is the directory**: prominent search + filters + item grid at the apex
  URL. Compact pitch strip for signed-out visitors (no full hero).
- **Activity rail**: right column shows recent community activity (compact)
  + newsletter, linking to /activity — social stays visible, not central.
- **/activity**: the 0024 timeline (tabs, composer, load-more) moves here.
- **/directory → /** redirect (params preserved); Filters push to /.
- **Nav rework**: Directory (home) · Activity · Leaderboard · Submit ·
  Messages; mobile tabs likewise (Directory home tab).

## Acceptance
- / renders search-first directory; filtering/search works at /.
- /activity carries the old feed (tabs + composer + pagination) — e2e moved.
- Old /directory URLs redirect with query intact.
