---
id: 082
title: "e2e: submissions.spec.ts:10 is timing-flaky in full-suite runs"
status: open
priority: low
horizon: next
hitl: false
type: bug
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: []
refs: ["074", "080"]
depends_on: []
acceptance:
  - "The spec passes reliably in full-suite runs (10 consecutive green) or the racy wait is replaced with a deterministic one"
agent_id: 1000x-ai-engineer
agent_scope: global
agent_kind: classic
---

Observed twice on 2026-08-02, both times only in full-suite runs (32/33 in the
PR #85 review, 35/36 in the 0081 pass), green every time in isolation and on
re-run. The submit → redirect → 'Awaiting score…' flow at `submissions.spec.ts:10`
appears timing-sensitive under suite load. Also logged as low finding `0c039ed4`
in the PR #85 review artifact. Fold the fix into the 0080 CI work — a flake
that's tolerable locally becomes a red-herring in CI.
