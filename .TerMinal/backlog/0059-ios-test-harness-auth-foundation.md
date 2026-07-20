---
id: 059
title: "iOS: XCTest harness + auth/networking foundation (Keychain, bearer, sign-in)"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: []
depends_on: ["057"]
acceptance:
  - "project.yml gains an AIxTests unit-test target; xcodebuild test passes on the iOS simulator"
  - "Decoding tests for all API models against fixture JSON captured from the real endpoints"
  - "APIClient supports bearer auth, injected via a protocol-backed session so tests run without network"
  - "AuthStore: ASWebAuthenticationSession sign-in (aix:// callback), Keychain token storage, sign-out; covered by unit tests with a mocked auth session"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

The existing `ios/` app (XcodeGen, SwiftUI, iOS 17+) has no test target and no
auth. Before feature work: add the XCTest target and put the failing tests in
first (TDD), then build the foundation — Keychain-backed `AuthStore`,
`ASWebAuthenticationSession` flow against 0057's hand-off, bearer header on
`APIClient`, current-user state published to the UI, sign-in/out surfaced in
Settings and as a Profile tab gate.
