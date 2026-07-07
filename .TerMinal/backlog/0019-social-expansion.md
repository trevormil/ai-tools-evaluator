---
id: 19
title: "Full social layer: reposts, DMs, activity feed, notifications"
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
depends_on: [0004, 0018]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Turn AIx into a full social network for AI-first engineers (content = tools/papers).

## Scope
- **Reposts**: repost a post or an item (optional quote), shows in followers' feed.
- **Likes**: reuse the existing upvote as "like" (label consistently).
- **DMs**: 1:1 messaging — messages table, /messages inbox + conversation view,
  "Message" button on profiles + stack entries ("ask about their stack").
- **Activity feed**: activities table (actor, verb, object) surfacing events like
  "X added ripgrep to their stack", "X reposted", "X posted", "X followed you".
  Home feed = activity of people you follow, global fallback. Hook stack upsert,
  posts, reposts, follows to emit activities.
- **Notifications**: per-user inbox (reply, dm, repost-of-yours, new follower,
  someone added your submitted item to their stack) + nav unread badge +
  /notifications page + mark-read.

## Acceptance
- Can repost, DM, and see an activity feed + notifications with unread counts.
- Emitting is wired into real actions (reachable), not just tables.
