---
id: 016
title: "Audience-fit dimension (AI engineer vs vibe coder)"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-06
prs: []
refs: [ADR-0002, ARCH]
depends_on: [0001, 0002]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Strict audience block in @aix/core Evaluation: primary + independent aiEngineerFit/vibeCoderFit (0-100) + rationale. Denormalized primary_audience/ai_engineer_fit/vibe_coder_fit columns on items for filtering. Item page "Who it's for" block; directory audience filter.

## Acceptance
- Schema requires audience; core tests green.
- Item page renders audience; directory filters by primary audience. (verified e2e)
