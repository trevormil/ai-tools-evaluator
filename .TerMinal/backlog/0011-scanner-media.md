---
id: 011
title: "Scanner: media attachment (images/video per item)"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-07-06
updated: 2026-07-07
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/1"]
refs: [ADR-0002, ARCH]
depends_on: [0010]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Every item gets a visual: repo social-preview, README images/gifs, or generated cover. Cache/mirror; set coverImageUrl + mediaJson.

## Acceptance
- Each item has >=1 image; README gifs captured when present.
