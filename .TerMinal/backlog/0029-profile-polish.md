---
id: 29
title: "Profile polish: activity tab, deep-linkable tabs, stack DM affordance, dead code"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: feedback
created: 2026-07-06
updated: 2026-07-07
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0018, 0019, 0020]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Follow-ups from the ticket-intent audit (0019/0020 gaps):

- **Per-profile activity**: `activities` are only consumed by the home feed; a
  profile shows no "what has @x been doing". Add an Activity tab querying by
  actor.
- **Deep-linkable tabs**: profile tabs are client state only — support
  `?tab=stack|workflow|articles|activity` so tabs are shareable.
- **"Ask about their stack"**: Message affordance on stack entries (ticket 0019
  scope, never built).
- **Dead code**: `components/message-button.tsx` is never imported (profile
  hand-rolls the link) — use it or remove it.

## Acceptance
- /u/x?tab=activity renders that tab directly with the actor's activity stream.
- Stack entries show a message affordance for signed-in non-owners.
- No orphan message-button component.
