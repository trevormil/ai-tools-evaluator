---
id: 059
title: "iOS: XCTest harness + read-only networking foundation"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/56"]
refs: []
depends_on: ["058"]
acceptance:
  - "project.yml gains an AIxTests unit-test target; xcodebuild test passes on the iOS simulator"
  - "Decoding tests for all API models against fixture JSON matching the real endpoint shapes (incl. lenient unknown-enum handling and the lens-aware evaluation body)"
  - "APIClient covers the read surface (items, item detail + README, feed, leaderboard, recap, daily pick) and is tested offline via a URLProtocol stub"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

The existing `ios/` app (XcodeGen, SwiftUI, iOS 17+) had no test target. Add
the XCTest harness and grow the model/networking layer to the full read
surface, with the evaluation body made lens-aware (ADR-0003 lenses).

*(Rescoped 2026-07-20: originally included Keychain/ASWebAuthenticationSession
auth foundation — dropped with the read-only app pivot.)*
