---
id: 004
title: "Web: posts feed, comments, votes, profiles, follows"
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
depends_on: [0002,0005]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Compose posts (optionally attached to an item), reply threads, upvotes. Profiles (avatar, bio, activity), follow/unfollow. Nested comments on items and posts; vote endpoints with unique-per-user constraint.

## Acceptance
- Logged-in user can post, comment, vote, follow; profile lists activity.
