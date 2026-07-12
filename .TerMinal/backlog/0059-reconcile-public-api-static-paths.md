---
id: 0059
title: "reconcile public API for static export: /api/v1/items.json path + docs + iOS"
status: open
priority: medium
horizon: next
hitl: false
type: chore
source: manual
created: 2026-07-12
updated: 2026-07-12
prs: []
refs: [ADR-0004]
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Static export (ADR-0004 phase 4) forced two public-API changes:
- The list endpoint moved **/api/v1/items → /api/v1/items.json** (a bare
  `items` file collides EISDIR with the `items/` dir needed for per-item
  `items/[slug]`).
- `/api/v1/dump` no longer paginates (static handlers get no request params) —
  it returns the whole corpus in one response; `/api/v1/items.json` returns the
  full list unfiltered (client filters).

Follow-ups:
1. Update `docs/public-api.md` — it still documents query params, cursor
   pagination, and the old `/api/v1/items` path.
2. Update the iOS client (`ios/`) to hit `/api/v1/items.json` and the
   single-response dump.
3. Consider static paginated shards (`items/page-N.json`) if the corpus grows
   past a comfortable single-file size.
