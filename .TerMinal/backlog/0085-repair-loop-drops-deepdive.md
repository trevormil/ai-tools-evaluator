---
id: 085
title: "Evaluator: a tagline repair round regenerates the draft and drops deepDive"
status: in-progress
priority: high
horizon: now
hitl: false
type: bug
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: []
refs: ["076", "083"]
depends_on: []
acceptance:
  - "A complete tagline that merely lacks final punctuation is punctuated by sanitize (<=150 chars), not sent to repair"
  - "Near-cap punctuation-less taglines still fail into repair (the 0076 truncation guard holds)"
  - "The repair prompt instructs the model to fix only the offending fields and preserve optional blocks (deepDive/quickstart/decision)"
agent_id: 1000x-ai-engineer
agent_scope: repo
agent_kind: classic
---

Found live on the first prod rescore (QM, 2026-08-02): the model emitted a full
deepDive (883-char howItWorks, 7-component architecture) but the draft failed
the 0076 tagline regex — a complete sentence missing its final period. The
repair round then regenerated the whole draft and dropped the optional
deepDive, so the stored evaluation had no one-pager. Diagnosed with
scripts/probe-deepdive.ts (one-call shape probe against the real model/prompt).
