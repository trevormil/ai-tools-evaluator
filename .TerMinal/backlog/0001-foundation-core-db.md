---
id: 001
title: "Foundation: @aix/core strict schema + @aix/db SQLite layer"
status: closed
priority: critical
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-07
prs: []
refs: [ADR-0002, ARCH]
depends_on: []
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Shared contract. @aix/core: strict zod Evaluation schema, 10-metric weighted scorecard, forced verdict enum, category/integration taxonomy, markdown (de)serializer with round-trip JSON block, evaluator prompt. @aix/db: Drizzle + bun:sqlite schema + boot migrator.

## Acceptance
- bun test packages/core green.
- Migrations apply and smoke insert/read works.
