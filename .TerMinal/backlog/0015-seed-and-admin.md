---
id: 015
title: "Seed data, admin/mod tooling, ranking cron"
status: in-progress
priority: medium
horizon: next
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0003,0004]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Seed script (real evaluations so site not empty), hot-ranking recompute job, minimal mod tools (hide, ban).

## Acceptance
- bun run seed populates demo data; hot ranking recomputes items.score on a schedule.
