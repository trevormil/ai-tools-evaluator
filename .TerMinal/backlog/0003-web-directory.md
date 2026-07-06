---
id: 003
title: "Web: directory list + filters + item detail scorecard page"
status: in-progress
priority: high
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0002]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

List/grid of items (cover, verdict badge, overall score, chips). Filters: category, integration, verdict, min score, search. Sort: hot/new/top. Item detail: 5 sections + scorecard table with per-metric bars + rationale + media gallery + comments.

## Acceptance
- Filtering narrows results; detail renders all five sections + 10-metric card.
