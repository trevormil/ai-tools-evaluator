---
id: 083
title: "One-pagers: deep-dive sections — how it works + real architecture diagrams"
status: closed
priority: medium
horizon: now
hitl: false
type: feature
source: manual
created: 2026-08-02
updated: 2026-08-02
prs: []
refs: ["081"]
depends_on: ["081"]
acceptance:
  - "Evaluation schema carries an optional deepDive: howItWorks prose, a validated architecture graph (components + flows), internals"
  - "The evaluator prompt requests it grounded in the README; sanitize prunes malformed graphs instead of failing"
  - "The one-pager renders How it works, a deterministic SVG architecture diagram, and Under the hood — omitted cleanly when absent"
  - "ripgrep seed fixture carries a hand-authored deep dive; e2e asserts the sections and the diagram"
agent_id: 1000x-ai-engineer
agent_scope: repo
agent_kind: classic
---

The point of a one-pager is learning the tool WITHOUT installing it. The stored
evaluation now carries the behind-the-scenes layer (generated at scan time from
the README the evaluator already reads — fractions of a cent per item), and the
UI renders the architecture graph as a real layered-DAG diagram. Existing rows
backfill via rescore.
