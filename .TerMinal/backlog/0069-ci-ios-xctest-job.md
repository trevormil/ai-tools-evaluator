---
id: 069
title: "CI: run the iOS XCTest suite on a macOS runner"
status: open
priority: low
horizon: future
hitl: false
type: chore
source: code-review
created: 2026-07-20
updated: 2026-07-20
prs: []
refs: ["https://github.com/trevormil/ai-tools-evaluator/pull/56"]
depends_on: []
acceptance:
  - "ci.yml gains a macos job: xcodegen generate + xcodebuild test on an iPhone simulator, gated to changes under ios/"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Suggested by the code-review agent on PR #56 (suggestion fcc643e7): the new
AIxTests suite (30 tests) currently runs only on dev machines. macOS runners
are 10× Linux minutes, so gate the job with a `paths: ios/**` filter.
