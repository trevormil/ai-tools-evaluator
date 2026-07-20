---
id: 072
title: "iOS: share extension (save links from any app) + Spotlight indexing of favorites"
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
depends_on: ["068"]
acceptance:
  - "Favorites (items + links) are indexed in Core Spotlight; system search results deep-link into the app (item detail / link)  [SHIPPED]"
  - "Share extension code + pending-queue drain + suite migration written and unit-tested; extension TARGET parked — free personal teams can't provision the App Group entitlement (verified 2026-07-20). Re-enable per the commented block in project.yml once the paid enrollment (open HITL) lands"
  - "No widget, no new notifications (explicitly descoped by Trevor)"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Account-free iOS-native surfaces. Risk called out up front: App Groups on a
free personal team may fail provisioning — if it does, ship Spotlight (no
entitlements needed) and park the extension until the paid Apple Developer
enrollment (see open HITL) unlocks it.
