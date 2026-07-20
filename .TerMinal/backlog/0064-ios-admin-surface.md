---
id: 064
title: "iOS: admin/mod surface (hide items, remove posts, scan-run observability)"
status: icebox
priority: low
horizon: future
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["059"]
acceptance:
  - "Admin tab visible only to role admin/mod: recent items with hide/unhide, recent posts with remove, scan-runs table"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Mobile mirror of `/admin` + `/api/admin/hide`. Iceboxed 2026-07-20: the iOS
app is read-only with no accounts at all, so an admin surface is doubly moot.
The admin page works fine on mobile web. Revisit only if the app ever grows
sign-in.
