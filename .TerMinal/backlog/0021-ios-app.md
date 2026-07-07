---
id: 21
title: "Native SwiftUI iOS app (reads public API v1)"
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
depends_on: [0003]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

A native SwiftUI iOS client consuming the public read API v1 (/api/v1/items).

## Scope
- Directory browse with filters (category/verdict/audience/search/sort).
- Item detail: 5 sections, 10-metric scorecard, audience-fit, verdict, source link.
- Leaderboard. Configurable API base URL (default https://aix.trevormil.com).
- Read-first (writes need token auth — future).

## Acceptance
- Xcode project builds for the iOS Simulator (xcodebuild) and renders the
  directory + item detail against the live API shape.
