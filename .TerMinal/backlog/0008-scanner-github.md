---
id: 008
title: "Scanner: GitHub trending discovery, rate-limit-resilient"
status: closed
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-07
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0001,0006]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Octokit discovery in apps/scanner: recently-created + fast-rising repos across rotating facets, authenticated token, ETag/conditional requests, backoff on secondary limits, per-run API budget. Any notable repo, not just AI.

## Acceptance
- Returns candidates with signals; respects per-run cap; backs off on 403.
