---
id: 088
title: "assembleEvaluation silently dropped ALL optional blocks — deepDive, quickstart, decision, productShape"
status: in-progress
priority: critical
horizon: now
hitl: false
type: bug
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: []
refs: ["078", "083", "085", "087"]
depends_on: []
acceptance:
  - "assembleEvaluation forwards productShape, quickstart, decision, and deepDive from the draft"
  - "A deepDive from a failed attempt is grafted into a repaired draft that lost it (deterministic, tested)"
  - "productShape survival is pinned by a test (it is the 0078 daily-pick signal)"
agent_id: 1000x-ai-engineer
agent_scope: repo
agent_kind: classic
---

The third live-rescore investigation found the real dropper: the evaluator's
final assembly step builds the Evaluation field-by-field and never copied the
optional blocks. Every AI-scanned item since each block shipped lost it at the
last step — deepDive (0083, why no prod one-pager ever appeared), quickstart +
decision (0039), and productShape (0078: the daily pick has been renormalizing
around an absent signal on AI-scanned items). The strict final parse can't
catch optional omissions by design. Also grafts deepDive across repair rounds
in code rather than trusting the model to obey the preserve instruction
(kaas probe: model emits a perfect block; prod repair rounds regenerated
without it).
