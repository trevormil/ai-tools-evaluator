---
id: 33
title: "\"I use this\" one-click on the item page"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0018, 0026]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Per-tool social, directory-first: a one-tap "I use this" toggle on the item
page (next to vote/repost/comment) that upserts a stack entry (status: using)
and shows the live user count. Backed entirely by the existing stack_items
table + /api/stack — this is an affordance, not a new system.

## Acceptance
- Signed-in: clicking toggles membership; count updates; entry appears in the
  user's My Stack; toggling off deletes the entry.
- Signed-out: click routes to sign-in.
- e2e covers the toggle round-trip.
