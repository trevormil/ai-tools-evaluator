---
id: 18
title: "Profiles: My Stack — tools you run + your take"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0004]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Let users curate the tools currently in their stack, with a personal take on each.
Turns profiles into a practitioner signal (what people actually run, honestly).

## Design
- DB table `stack_items`: id, userId(fk), itemId(fk items, nullable), toolName(text,
  for tools not yet in the directory), status(using|trying|want-to-try|dropped),
  take(text opinion), rating(1-5, optional), createdAt, updatedAt. Unique per
  (userId, itemId) and (userId, lower(toolName)).
- Web:
  - Profile `/u/[username]`: "My Stack" section grouped by status; each entry shows
    the take + links to the catalogued item when itemId is set.
  - Owner-only editor: add entry (search directory items OR free-form tool name),
    pick status, write take, rating; edit/remove.
  - Routes (session-gated): POST/PATCH/DELETE `/api/stack`.
- Item detail (phase 2): "N engineers run this" + surface a few takes.

## Acceptance
- A logged-in user can add/edit/remove stack entries (catalogued item or free-form).
- Their profile renders the stack grouped by status with takes.
- Uniqueness enforced; only the owner can mutate their stack.
