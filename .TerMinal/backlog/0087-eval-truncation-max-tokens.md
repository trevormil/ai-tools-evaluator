---
id: 087
title: "Evaluator: deepDive pushes completions past max_tokens 4096 — truncated JSON hard-fails"
status: in-progress
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: ["https://github.com/trevormil/ai-tools-evaluator/pull/92"]
refs: ["083", "085"]
depends_on: []
acceptance:
  - "Model clients default to a completion budget that fits an evaluation with a full deepDive (>= 8192)"
  - "A unit test pins the requested max_tokens"
agent_id: 1000x-ai-engineer
agent_scope: repo
agent_kind: classic
---

Second live rescore failure (2026-08-02): poirot's eval died with "JSON Parse
error: Expected ']'" on all 3 attempts — the completion was truncated at the
4096 max_tokens both clients defaulted to, which a ten-metric draft PLUS the
0083 deepDive no longer fits. qwen-audio-agent survived by shrinking on repair
(dropping deepDive — the 0085 shape). Fix: default both clients to 8192.
Worst-case marginal cost on deepseek-flash: still well under a cent per item.
