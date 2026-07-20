---
id: 062
title: "iOS: notifications, DMs, recap + leaderboard parity"
status: in-progress
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["058", "059"]
acceptance:
  - "Notifications screen: inbox list with unread styling, mark-all-read on view, unread badge on tab"
  - "Messages: conversation list with unread badges; thread view with composer; marks read on open"
  - "Recap screen: latest recap + date navigation + archive list"
  - "Leaderboard upgraded to the three web lists (top rated, most discussed, complexity-trap hall of shame)"
  - "ViewModel unit tests for unread accounting and thread mark-read (mocked client)"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Web reference: `/notifications`, `/messages`, `/messages/[userId]`, `/recap*`,
`/leaderboard`. Notifications + messages use the existing authed JSON endpoints
(`/api/notifications`, `/api/messages*`) via bearer (0057); recap + leaderboard
use 0058's new v1 reads. No push notifications in v1 — in-app inbox only
(push = separate future ticket; needs APNs infra).
