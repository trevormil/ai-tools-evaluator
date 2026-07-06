---
id: 010
title: "Scanner: Claude evaluation pipeline + dedup + daily cap + .md export"
status: open
priority: critical
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0001,0006,0008]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Drain queue first, then trending, dedup against items, cap 10/day. Per item: fetch README/abstract, call Claude (skeptic prompt), validate EvaluationDraft, recompute overallScore, publish via internal API, export strict .md to content/items/, record scan_runs.

## Acceptance
- E2E run publishes <=10, skips dupes, writes artifacts; malformed output rejected+retried.
