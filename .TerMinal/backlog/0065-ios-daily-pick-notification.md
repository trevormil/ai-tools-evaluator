---
id: 065
title: "iOS: daily pick local notification (morning reminder, deep link)"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["060"]
acceptance:
  - "Settings toggle schedules ONE repeating 9am local calendar notification (UNCalendarNotificationTrigger); disabling removes it"
  - "Denied notification permission flips the toggle back off with a friendly pointer to system Settings"
  - "Tapping the notification opens the app on the current daily pick's detail (falls back to the feed if none)"
  - "Scheduler unit-tested against a fake notification center (trigger hour, repeat flag, identifier, userInfo route)"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Local-only (no APNs infra): a repeating morning reminder that today's pick is
live. Fire hour sits after the server's daily-pick morning post-time gate
(PR #53). The tap handler resolves the pick via `GET /api/v1/daily-pick` at
open time, so the content is always current even though the notification body
is static. Push notifications with real pick content = separate future ticket
if ever wanted (needs APNs + server sender).
