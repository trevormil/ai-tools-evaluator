---
id: 009
title: "Scanner: arXiv paper discovery"
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
depends_on: [0001]
acceptance: []
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Poll arXiv recent listings politely (<=1 req/3s) across categories; map to ItemSource kind=arxiv_paper (authors, abstract, published date).

## Acceptance
- Returns recent papers with abstract + metadata; rate limited politely.
